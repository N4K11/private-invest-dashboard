import type { PriceSourceType, Prisma } from "@prisma/client";

import { getEnv } from "@/lib/env";
import { extractManualAssetProfile } from "@/lib/saas/manual-assets";
import type {
  SaasPriceConfidenceStatus,
  SaasAssetCategory,
} from "@/types/saas";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function toJsonRecord(value: Prisma.JsonValue | null | undefined) {
  return isRecord(value) ? value : {};
}

export function getManualTimestamp(
  metadata: Prisma.JsonValue | null | undefined,
  fallbackUpdatedAt: string,
) {
  const manualProfile = extractManualAssetProfile(metadata);
  if (manualProfile.lastEditedAt) {
    return manualProfile.lastEditedAt;
  }

  const importMeta = toJsonRecord(toJsonRecord(metadata).import);
  if (typeof importMeta.importedAt === "string") {
    return importMeta.importedAt;
  }

  return fallbackUpdatedAt;
}

export function isTimestampStale(timestamp: string | null, staleAfterMs: number) {
  if (!timestamp) {
    return true;
  }

  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) {
    return true;
  }

  return Date.now() - parsed > staleAfterMs;
}

export function deriveManualPriceConfidenceStatus(options: {
  metadata: Prisma.JsonValue | null | undefined;
  fallbackUpdatedAt: string;
  staleAfterMs: number;
  hasPrice: boolean;
}) {
  if (!options.hasPrice) {
    return "unknown" as SaasPriceConfidenceStatus;
  }

  const manualProfile = extractManualAssetProfile(options.metadata);
  const priceTimestamp = getManualTimestamp(options.metadata, options.fallbackUpdatedAt);

  if (isTimestampStale(priceTimestamp, options.staleAfterMs)) {
    return "stale" as SaasPriceConfidenceStatus;
  }

  if (manualProfile.confidence === "high" || manualProfile.confidence === "medium") {
    return "manual_high" as SaasPriceConfidenceStatus;
  }

  return "manual_low" as SaasPriceConfidenceStatus;
}

export function buildSnapshotCapturedAt(ttlSeconds: number) {
  const bucketSizeMs = Math.max(30, ttlSeconds) * 1000;
  const bucketStartMs = Math.floor(Date.now() / bucketSizeMs) * bucketSizeMs;
  return new Date(bucketStartMs).toISOString();
}

export function getSaasCryptoTtlSeconds() {
  return getEnv().SAAS_CRYPTO_PRICE_TTL_SECONDS;
}

export function getSaasCs2TtlSeconds() {
  return getEnv().SAAS_CS2_PRICE_TTL_SECONDS;
}

export function getSaasTelegramTtlSeconds() {
  return getEnv().SAAS_TELEGRAM_PRICE_TTL_SECONDS;
}

export function getSaasCustomTtlSeconds() {
  return getEnv().SAAS_CUSTOM_PRICE_TTL_SECONDS;
}

export function getManualStaleAfterMs(category: SaasAssetCategory) {
  const env = getEnv();

  if (category === "cs2") {
    return env.CS2_PRICE_STALE_HOURS * 60 * 60 * 1000;
  }

  if (category === "telegram") {
    return env.TELEGRAM_PRICE_STALE_DAYS * 24 * 60 * 60 * 1000;
  }

  return env.SAAS_MANUAL_PRICE_STALE_HOURS * 60 * 60 * 1000;
}

export function buildPriceCacheKey(prefix: string, values: string[]) {
  return `${prefix}:${values.sort().join(",")}`;
}

export function buildUnknownDetails(label: string) {
  return [`No price was resolved for ${label}.`];
}

export function normalizePriceSourceLabel(sourceId: string) {
  switch (sourceId) {
    case "coingecko_live":
      return "CoinGecko";
    case "binance_live":
      return "Binance";
    case "cs2_manual":
      return "Manual CS2";
    case "telegram_manual_otc":
      return "Manual Telegram OTC";
    case "custom_manual":
      return "Manual Custom";
    case "imported_price":
      return "Imported price";
    case "entry_price_fallback":
      return "Entry price fallback";
    default:
      return sourceId.replace(/_/g, " ");
  }
}

export function mapSourceIdToSnapshotSource(sourceId: string, fallback: PriceSourceType): PriceSourceType {
  if (sourceId === "coingecko_live") {
    return "COINGECKO";
  }

  if (sourceId === "telegram_ton_conversion") {
    return "TELEGRAM_TON_CONVERSION";
  }

  if (sourceId === "cs2_steam_adapter") {
    return "STEAM_MARKET";
  }

  if (sourceId === "cs2_csfloat_adapter") {
    return "CSFLOAT";
  }

  if (sourceId === "cs2_pricempire_adapter") {
    return "PRICEEMPIRE";
  }

  return fallback;
}