import {
  forgetRemembered,
  forgetRememberedByPrefix,
  getRememberedStats,
} from "@/lib/cache/ttl-store";
import type { CacheHealthSnapshot, HealthTone } from "@/types/health";

function deriveCacheTone(
  totalEntries: number,
  inFlightEntries: number,
  remoteEnabled: boolean,
  remoteHealthy: boolean | null,
): HealthTone {
  if (remoteEnabled && remoteHealthy === false) {
    return "warning";
  }

  if (totalEntries === 0 && inFlightEntries === 0) {
    return "warning";
  }

  if (inFlightEntries > 0) {
    return "info";
  }

  return "ok";
}

export async function invalidatePortfolioCaches() {
  await Promise.all([
    forgetRemembered("portfolio-source"),
    forgetRememberedByPrefix("coingecko:"),
    forgetRememberedByPrefix("cs2:"),
  ]);
}

export async function getPortfolioCacheHealth(): Promise<CacheHealthSnapshot> {
  const stats = await getRememberedStats();
  const priceEntries = stats.cacheKeys.filter(
    (key) => key.startsWith("coingecko:") || key.startsWith("cs2:"),
  ).length;
  const sourceEntries = stats.cacheKeys.filter((key) => key === "portfolio-source").length;
  const tone = deriveCacheTone(
    stats.totalEntries,
    stats.inFlightEntries,
    stats.remoteEnabled,
    stats.remoteHealthy,
  );

  return {
    tone,
    summary:
      stats.totalEntries > 0
        ? `${stats.driver === "redis_rest" ? "Hybrid cache" : "Memory cache"}: ${stats.totalEntries} local entries, из них ${priceEntries} относятся к price providers.`
        : stats.driver === "redis_rest"
          ? "Локальный memory cache пуст, внешний Redis REST cache используется как shared fallback."
          : "Кэш пуст или только что был очищен.",
    driver: stats.driver,
    remoteEnabled: stats.remoteEnabled,
    remoteHealthy: stats.remoteHealthy,
    remoteSummary: stats.remoteSummary,
    totalEntries: stats.totalEntries,
    priceEntries,
    sourceEntries,
    inFlightEntries: stats.inFlightEntries,
    portfolioSourceCached: stats.portfolioSourceCached,
  };
}
