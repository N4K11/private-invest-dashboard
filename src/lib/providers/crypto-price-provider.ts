import { remember } from "@/lib/cache/ttl-store";
import { COINGECKO_SYMBOL_MAP } from "@/lib/constants";
import { getEnv } from "@/lib/env";
import { computeMoneyMetrics } from "@/lib/portfolio/metrics";
import type { NormalizedCryptoRow } from "@/lib/sheets/normalizers";
import type { CryptoPosition } from "@/types/portfolio";

type CryptoQuote = {
  symbol: string;
  price: number | null;
  source: string;
  isLive: boolean;
};

async function fetchQuotes(symbols: string[]) {
  const env = getEnv();
  const uniqueSymbols = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))];
  const resolvedIds = uniqueSymbols
    .map((symbol) => ({ symbol, id: COINGECKO_SYMBOL_MAP[symbol] }))
    .filter((item): item is { symbol: string; id: string } => Boolean(item.id));

  if (resolvedIds.length === 0) {
    return {} as Record<string, CryptoQuote>;
  }

  return remember(
    `coingecko:${resolvedIds.map((item) => item.symbol).join(",")}`,
    env.PRICE_CACHE_TTL_SECONDS * 1000,
    async () => {
      try {
        const url = new URL("https://api.coingecko.com/api/v3/simple/price");
        url.searchParams.set(
          "ids",
          resolvedIds.map((item) => item.id).join(","),
        );
        url.searchParams.set("vs_currencies", "usd");

        const response = await fetch(url, {
          headers: env.COINGECKO_API_KEY
            ? {
                "x-cg-demo-api-key": env.COINGECKO_API_KEY,
              }
            : undefined,
          next: {
            revalidate: env.PRICE_CACHE_TTL_SECONDS,
          },
        });

        if (!response.ok) {
          throw new Error(`CoinGecko returned ${response.status}`);
        }

        const payload = (await response.json()) as Record<string, { usd?: number }>;

        return resolvedIds.reduce<Record<string, CryptoQuote>>((quotes, item) => {
          const livePrice = payload[item.id]?.usd;
          quotes[item.symbol] = {
            symbol: item.symbol,
            price: typeof livePrice === "number" ? livePrice : null,
            source: typeof livePrice === "number" ? "coingecko" : "sheet_fallback",
            isLive: typeof livePrice === "number",
          };
          return quotes;
        }, {});
      } catch {
        return resolvedIds.reduce<Record<string, CryptoQuote>>((quotes, item) => {
          quotes[item.symbol] = {
            symbol: item.symbol,
            price: null,
            source: "sheet_fallback",
            isLive: false,
          };
          return quotes;
        }, {});
      }
    },
  );
}

export async function resolveCryptoPositions(rows: NormalizedCryptoRow[]) {
  const quotes = await fetchQuotes(rows.map((row) => row.symbol));

  const positions: CryptoPosition[] = rows.map((row) => {
    const quote = quotes[row.symbol];
    const currentPrice = quote?.price ?? row.currentPrice ?? row.averageEntryPrice ?? null;
    const metrics = computeMoneyMetrics(
      row.quantity,
      row.averageEntryPrice,
      currentPrice,
    );

    return {
      id: row.id,
      symbol: row.symbol,
      name: row.name,
      quantity: row.quantity,
      averageEntryPrice: row.averageEntryPrice,
      currentPrice,
      totalValue: metrics.totalValue,
      totalCost: metrics.totalCost,
      pnl: metrics.pnl,
      pnlPercent: metrics.pnlPercent,
      notes: row.notes,
      priceSource: quote?.isLive
        ? quote.source
        : row.currentPrice !== null
          ? "manual_sheet"
          : "entry_price_fallback",
      isLivePrice: quote?.isLive ?? false,
    };
  });

  const warnings = positions.some((position) => !position.isLivePrice)
    ? [
        "Some crypto prices are using sheet fallback because live market quotes are unavailable for part of the portfolio.",
      ]
    : [];

  return {
    positions,
    warnings,
  };
}
