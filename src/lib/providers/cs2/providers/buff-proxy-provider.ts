import { remember } from "@/lib/cache/ttl-store";
import { getEnv } from "@/lib/env";
import type {
  Cs2PriceProvider,
  Cs2ResolvedPriceQuote,
} from "@/lib/providers/cs2/types";
import {
  canonicalizeCs2AssetName,
  inferCs2LiquidityFromDepth,
  normalizeCs2LiquidityLabel,
} from "@/lib/providers/cs2/utils";

type ProxyPriceEntry = {
  assetName?: string;
  matchedName?: string;
  canonicalName?: string;
  price?: number;
  currency?: string;
  confidence?: string;
  liquidityLabel?: string;
  liquidityDepth?: number;
  depth?: number;
  lastUpdated?: string;
  warning?: string;
};

type ProxyPayload = {
  items?: ProxyPriceEntry[];
};

function normalizeConfidence(value: string | undefined): Cs2ResolvedPriceQuote["confidence"] {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }

  return "medium";
}

export function createBuffProxyCs2PriceProvider(): Cs2PriceProvider {
  return {
    id: "buff_proxy",
    sourceName: "Custom Buff Proxy",
    isEnabled() {
      return Boolean(getEnv().CS2_BUFF_PROXY_URL);
    },
    async getPrice(input) {
      const { quotes } = await this.getBulkPrices([input]);
      return quotes.get(input.assetId) ?? null;
    },
    async getBulkPrices(inputs) {
      const env = getEnv();
      const endpoint = env.CS2_BUFF_PROXY_URL;

      if (!endpoint) {
        return {
          quotes: new Map(),
          warnings: [
            "CS2 buff proxy provider пропущен: не задан CS2_BUFF_PROXY_URL.",
          ],
        };
      }

      const cacheKey = `cs2:buff-proxy:${inputs.map((item) => item.assetName).sort().join("|")}`;
      const payload = await remember(cacheKey, env.PRICE_CACHE_TTL_SECONDS * 1000, async () => {
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(env.CS2_BUFF_PROXY_TOKEN
                ? {
                    Authorization: `Bearer ${env.CS2_BUFF_PROXY_TOKEN}`,
                  }
                : {}),
            },
            body: JSON.stringify({
              assetNames: inputs.map((item) => item.assetName),
            }),
            signal: AbortSignal.timeout(8000),
            next: {
              revalidate: env.PRICE_CACHE_TTL_SECONDS,
            },
          });

          if (!response.ok) {
            throw new Error(`Buff proxy returned ${response.status}`);
          }

          return (await response.json()) as ProxyPayload;
        } catch {
          return null;
        }
      });

      const quotes = new Map();

      for (const input of inputs) {
        const match = payload?.items?.find((item) => item.assetName === input.assetName);
        if (!match || typeof match.price !== "number") {
          continue;
        }

        const liquidityDepth =
          typeof match.liquidityDepth === "number"
            ? match.liquidityDepth
            : typeof match.depth === "number"
              ? match.depth
              : null;

        quotes.set(input.assetId, {
          assetId: input.assetId,
          assetName: input.assetName,
          price: match.price,
          currency: match.currency?.trim().toUpperCase() ?? null,
          sourceId: "buff_proxy",
          sourceName: "Custom Buff Proxy",
          matchedName: match.matchedName ?? input.assetName,
          canonicalName:
            match.canonicalName ?? canonicalizeCs2AssetName(match.matchedName ?? input.assetName),
          lastUpdated: match.lastUpdated ?? new Date().toISOString(),
          confidence: normalizeConfidence(match.confidence),
          isLive: true,
          warning: match.warning ?? null,
          liquidityLabel:
            normalizeCs2LiquidityLabel(match.liquidityLabel) ??
            inferCs2LiquidityFromDepth(liquidityDepth),
          liquidityDepth,
        } satisfies Cs2ResolvedPriceQuote);
      }

      return {
        quotes,
        warnings:
          quotes.size > 0
            ? [`Buff proxy вернул live-цены для ${quotes.size} CS2-позиций.`]
            : ["Buff proxy не вернул ни одной цены для текущего батча CS2-активов."],
      };
    },
  };
}
