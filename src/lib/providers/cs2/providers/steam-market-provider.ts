import { remember } from "@/lib/cache/ttl-store";
import type { Cs2PriceProvider } from "@/lib/providers/cs2/types";
import {
  buildCs2QueryVariants,
  buildSteamTargetName,
  inferCs2LiquidityFromDepth,
  mapWithConcurrency,
  scoreSteamCandidate,
} from "@/lib/providers/cs2/utils";

type SteamMarketSearchResult = {
  name?: string;
  hash_name?: string;
  sell_price?: number;
  sale_price?: number;
  sell_listings?: number;
};

type SteamSearchPayload = {
  success?: boolean;
  results?: SteamMarketSearchResult[];
};

type SteamSearchResult = {
  query: string;
  payload: SteamSearchPayload | null;
};

const STEAM_MARKET_TTL_MS = 1000 * 60 * 60 * 6;
const STEAM_MARKET_CONCURRENCY = 10;
const STEAM_MATCH_MIN_SCORE = 180;

async function fetchSteamSearch(query: string): Promise<SteamSearchResult> {
  return remember(`cs2:steam:v2:${query}`, STEAM_MARKET_TTL_MS, async () => {
    const url = new URL("https://steamcommunity.com/market/search/render/");
    url.searchParams.set("query", query);
    url.searchParams.set("appid", "730");
    url.searchParams.set("norender", "1");
    url.searchParams.set("count", "12");
    url.searchParams.set("l", "russian");
    url.searchParams.set("cc", "US");

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        },
        signal: AbortSignal.timeout(7000),
        next: {
          revalidate: Math.floor(STEAM_MARKET_TTL_MS / 1000),
        },
      });

      if (!response.ok) {
        throw new Error(`Steam returned ${response.status}`);
      }

      const payload = (await response.json()) as SteamSearchPayload;
      return {
        query,
        payload,
      };
    } catch {
      return {
        query,
        payload: null,
      };
    }
  });
}

export function createSteamMarketCs2PriceProvider(): Cs2PriceProvider {
  return {
    id: "steam",
    sourceName: "Steam Community Market",
    isEnabled() {
      return true;
    },
    async getPrice(input) {
      const { quotes } = await this.getBulkPrices([input]);
      return quotes.get(input.assetId) ?? null;
    },
    async getBulkPrices(inputs) {
      const queryMap = new Map<string, string[]>();

      for (const input of inputs) {
        queryMap.set(input.assetId, buildCs2QueryVariants(input.row));
      }

      const uniqueQueries = [...new Set([...queryMap.values()].flat())];
      const searchResults = await mapWithConcurrency(uniqueQueries, STEAM_MARKET_CONCURRENCY, (query) =>
        fetchSteamSearch(query),
      );
      const searchesByQuery = new Map(searchResults.map((entry) => [entry.query, entry.payload]));
      const quotes = new Map();

      for (const input of inputs) {
        const targetName = buildSteamTargetName(input.row);
        let bestMatch:
          | {
              price: number | null;
              matchedName: string | null;
              score: number;
              sellListings: number | null;
            }
          | null = null;

        for (const query of queryMap.get(input.assetId) ?? []) {
          const payload = searchesByQuery.get(query);
          const results = payload?.results ?? [];

          for (const candidate of results) {
            const score = scoreSteamCandidate(targetName, candidate.name ?? "");
            const price =
              typeof candidate.sell_price === "number"
                ? candidate.sell_price / 100
                : typeof candidate.sale_price === "number"
                  ? candidate.sale_price / 100
                  : null;

            if (!bestMatch || score > bestMatch.score) {
              bestMatch = {
                price,
                matchedName: candidate.name ?? null,
                score,
                sellListings:
                  typeof candidate.sell_listings === "number" ? candidate.sell_listings : null,
              };
            }
          }
        }

        if (!bestMatch || bestMatch.score < STEAM_MATCH_MIN_SCORE || bestMatch.price === null) {
          continue;
        }

        quotes.set(input.assetId, {
          assetId: input.assetId,
          assetName: input.assetName,
          price: bestMatch.price,
          currency: "USD",
          sourceId: "steam",
          sourceName: "Steam Community Market",
          matchedName: bestMatch.matchedName,
          canonicalName: targetName,
          lastUpdated: new Date().toISOString(),
          confidence: bestMatch.score >= 10_000 ? "high" : bestMatch.score >= 2000 ? "medium" : "low",
          isLive: true,
          warning: null,
          liquidityLabel: inferCs2LiquidityFromDepth(bestMatch.sellListings),
          liquidityDepth: bestMatch.sellListings,
        });
      }

      const matchedCount = quotes.size;
      const warnings: string[] = [];

      if (matchedCount > 0) {
        warnings.push(
          `Steam Market обновил live-цены для ${matchedCount} CS2-позиций из ${inputs.length}.`,
        );
      }

      if (matchedCount < inputs.length) {
        warnings.push(
          `Для ${inputs.length - matchedCount} CS2-позиций Steam Market не дал точное совпадение. Они перейдут на следующий provider в цепочке.`,
        );
      }

      return {
        quotes,
        warnings,
      };
    },
  };
}
