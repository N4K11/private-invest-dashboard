import { remember } from "@/lib/cache/ttl-store";
import { COINGECKO_SYMBOL_MAP } from "@/lib/constants";
import { getEnv } from "@/lib/env";
import type {
  SaasPriceEnginePositionInput,
  SaasPriceProvider,
  SaasPriceProviderResult,
  SaasResolvedPriceQuote,
} from "@/lib/saas/price-engine/types";
import {
  buildPriceCacheKey,
  buildSnapshotCapturedAt,
  buildUnknownDetails,
  deriveManualPriceConfidenceStatus,
  getManualStaleAfterMs,
  getSaasCryptoTtlSeconds,
} from "@/lib/saas/price-engine/utils";

type LiveQuote = {
  symbol: string;
  price: number;
  sourceId: "coingecko_live" | "binance_live";
};

async function fetchCoinGeckoQuotes(symbols: string[]) {
  const env = getEnv();
  const resolvedIds = symbols
    .map((symbol) => ({ symbol, id: COINGECKO_SYMBOL_MAP[symbol] }))
    .filter((item): item is { symbol: string; id: string } => Boolean(item.id));

  if (resolvedIds.length === 0) {
    return {} as Record<string, LiveQuote>;
  }

  return remember(
    buildPriceCacheKey("saas-price:coingecko", resolvedIds.map((item) => item.symbol)),
    getSaasCryptoTtlSeconds() * 1000,
    async () => {
      try {
        const url = new URL("https://api.coingecko.com/api/v3/simple/price");
        url.searchParams.set("ids", resolvedIds.map((item) => item.id).join(","));
        url.searchParams.set("vs_currencies", "usd");

        const response = await fetch(url, {
          headers: env.COINGECKO_API_KEY
            ? {
                "x-cg-demo-api-key": env.COINGECKO_API_KEY,
              }
            : undefined,
          next: {
            revalidate: getSaasCryptoTtlSeconds(),
          },
        });

        if (!response.ok) {
          throw new Error(`CoinGecko returned ${response.status}`);
        }

        const payload = (await response.json()) as Record<string, { usd?: number }>;
        return resolvedIds.reduce<Record<string, LiveQuote>>((quotes, item) => {
          const price = payload[item.id]?.usd;
          if (typeof price === "number") {
            quotes[item.symbol] = {
              symbol: item.symbol,
              price,
              sourceId: "coingecko_live",
            };
          }
          return quotes;
        }, {});
      } catch {
        return {} as Record<string, LiveQuote>;
      }
    },
  );
}

async function fetchBinanceQuotes(symbols: string[]) {
  const eligible = symbols.filter((symbol) => !["USDT", "USDC"].includes(symbol));
  const stableQuotes = symbols.reduce<Record<string, LiveQuote>>((quotes, symbol) => {
    if (symbol === "USDT" || symbol === "USDC") {
      quotes[symbol] = {
        symbol,
        price: 1,
        sourceId: "binance_live",
      };
    }
    return quotes;
  }, {});

  if (eligible.length === 0) {
    return stableQuotes;
  }

  const liveQuotes = await remember(
    buildPriceCacheKey("saas-price:binance", eligible),
    getSaasCryptoTtlSeconds() * 1000,
    async () => {
      try {
        const symbolsPayload = eligible.map((symbol) => `${symbol}USDT`);
        const url = new URL("https://api.binance.com/api/v3/ticker/price");
        url.searchParams.set("symbols", JSON.stringify(symbolsPayload));

        const response = await fetch(url, {
          next: {
            revalidate: getSaasCryptoTtlSeconds(),
          },
        });

        if (!response.ok) {
          throw new Error(`Binance returned ${response.status}`);
        }

        const payload = (await response.json()) as Array<{ symbol: string; price: string }>;
        return payload.reduce<Record<string, LiveQuote>>((quotes, item) => {
          const matchedSymbol = item.symbol.replace(/USDT$/, "");
          const parsedPrice = Number(item.price);
          if (Number.isFinite(parsedPrice)) {
            quotes[matchedSymbol] = {
              symbol: matchedSymbol,
              price: parsedPrice,
              sourceId: "binance_live",
            };
          }
          return quotes;
        }, {});
      } catch {
        return {} as Record<string, LiveQuote>;
      }
    },
  );

  return {
    ...stableQuotes,
    ...liveQuotes,
  };
}

function buildManualQuote(input: SaasPriceEnginePositionInput): SaasResolvedPriceQuote {
  const manualPrice = input.manualCurrentPrice ?? input.currentPrice ?? input.averageEntryPrice ?? null;
  const sourceId =
    input.manualCurrentPrice !== null
      ? "manual_crypto"
      : input.currentPrice !== null
        ? "imported_price"
        : input.averageEntryPrice !== null
          ? "entry_price_fallback"
          : "crypto_missing";

  return {
    positionId: input.positionId,
    assetId: input.assetId,
    category: input.category,
    price: manualPrice,
    currency: input.baseCurrency,
    sourceId,
    sourceLabel:
      sourceId === "manual_crypto"
        ? "Manual crypto"
        : sourceId === "imported_price"
          ? "Imported price"
          : sourceId === "entry_price_fallback"
            ? "Entry price fallback"
            : "Missing price",
    snapshotSource: sourceId === "imported_price" ? "IMPORTED" : "MANUAL",
    confidenceStatus: deriveManualPriceConfidenceStatus({
      metadata: input.metadata,
      fallbackUpdatedAt: input.updatedAt,
      staleAfterMs: getManualStaleAfterMs(input.category),
      hasPrice: manualPrice !== null,
    }),
    isLive: false,
    ttlSeconds: getSaasCryptoTtlSeconds(),
    capturedAt: buildSnapshotCapturedAt(getSaasCryptoTtlSeconds()),
    lastUpdated: input.updatedAt,
    warning: manualPrice === null ? "Crypto position has no live or manual price." : null,
    details:
      manualPrice === null ? buildUnknownDetails(input.assetName) : ["Manual/imported fallback used."],
  };
}

export function createSaasCryptoPriceProvider(): SaasPriceProvider {
  return {
    id: "saas_crypto",
    sourceName: "SaaS Crypto Provider",
    categories: ["crypto"],
    ttlSeconds: getSaasCryptoTtlSeconds(),
    async resolve(inputs: SaasPriceEnginePositionInput[]): Promise<SaasPriceProviderResult> {
      const quotes = new Map<string, SaasResolvedPriceQuote>();
      const symbols = [...new Set(inputs.map((input) => (input.symbol ?? input.assetName).toUpperCase()))];
      const coinGeckoQuotes = await fetchCoinGeckoQuotes(symbols);
      const unresolvedSymbols = symbols.filter((symbol) => !coinGeckoQuotes[symbol]);
      const binanceQuotes = unresolvedSymbols.length > 0 ? await fetchBinanceQuotes(unresolvedSymbols) : {};
      const capturedAt = buildSnapshotCapturedAt(getSaasCryptoTtlSeconds());

      for (const input of inputs) {
        const symbol = (input.symbol ?? input.assetName).toUpperCase();
        const liveQuote = coinGeckoQuotes[symbol] ?? binanceQuotes[symbol] ?? null;

        if (liveQuote) {
          quotes.set(input.positionId, {
            positionId: input.positionId,
            assetId: input.assetId,
            category: input.category,
            price: liveQuote.price,
            currency: "USD",
            sourceId: liveQuote.sourceId,
            sourceLabel: liveQuote.sourceId === "coingecko_live" ? "CoinGecko" : "Binance",
            snapshotSource: liveQuote.sourceId === "coingecko_live" ? "COINGECKO" : "IMPORTED",
            confidenceStatus: liveQuote.sourceId === "coingecko_live" ? "live_high" : "live_medium",
            isLive: true,
            ttlSeconds: getSaasCryptoTtlSeconds(),
            capturedAt,
            lastUpdated: capturedAt,
            warning: null,
            details: [liveQuote.sourceId === "coingecko_live" ? "Live price from CoinGecko." : "Live fallback price from Binance."],
          });
          continue;
        }

        quotes.set(input.positionId, buildManualQuote(input));
      }

      return {
        quotes,
        warnings: [],
      };
    },
  };
}
