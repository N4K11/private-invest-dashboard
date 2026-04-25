import { forgetRemembered, forgetRememberedByPrefix, getRememberedStats } from "@/lib/cache/ttl-store";
import type { CacheHealthSnapshot, HealthTone } from "@/types/health";

function deriveCacheTone(totalEntries: number, inFlightEntries: number): HealthTone {
  if (totalEntries === 0 && inFlightEntries === 0) {
    return "warning";
  }

  if (inFlightEntries > 0) {
    return "info";
  }

  return "ok";
}

export function invalidatePortfolioCaches() {
  forgetRemembered("portfolio-source");
  forgetRememberedByPrefix("coingecko:");
  forgetRememberedByPrefix("cs2:");
}

export function getPortfolioCacheHealth(): CacheHealthSnapshot {
  const stats = getRememberedStats();
  const priceEntries = stats.cacheKeys.filter(
    (key) => key.startsWith("coingecko:") || key.startsWith("cs2:"),
  ).length;
  const sourceEntries = stats.cacheKeys.filter((key) => key === "portfolio-source").length;
  const tone = deriveCacheTone(stats.totalEntries, stats.inFlightEntries);

  return {
    tone,
    summary:
      stats.totalEntries > 0
        ? `В памяти ${stats.totalEntries} cache entries, из них ${priceEntries} относятся к price providers.`
        : "Кэш пуст или только что был очищен.",
    totalEntries: stats.totalEntries,
    priceEntries,
    sourceEntries,
    inFlightEntries: stats.inFlightEntries,
    portfolioSourceCached: stats.portfolioSourceCached,
  };
}
