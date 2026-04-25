import { extractManualAssetProfile } from "@/lib/saas/manual-assets";
import type {
  SaasPriceEnginePositionInput,
  SaasPriceProvider,
  SaasPriceProviderResult,
  SaasResolvedPriceQuote,
} from "@/lib/saas/price-engine/types";
import {
  buildSnapshotCapturedAt,
  buildUnknownDetails,
  deriveManualPriceConfidenceStatus,
  getManualStaleAfterMs,
  getSaasTelegramTtlSeconds,
  isTimestampStale,
} from "@/lib/saas/price-engine/utils";
import { formatTelegramPriceSourceLabel } from "@/lib/presentation";

function buildTelegramDetails(input: SaasPriceEnginePositionInput) {
  const manualProfile = extractManualAssetProfile(input.metadata);
  const details: string[] = ["Telegram gift price is maintained manually / OTC."];

  if (manualProfile.priceSource) {
    details.push(`Источник: ${formatTelegramPriceSourceLabel(manualProfile.priceSource)}.`);
  }

  if (manualProfile.priceNotes) {
    details.push(manualProfile.priceNotes);
  }

  if (
    manualProfile.lastVerifiedAt &&
    isTimestampStale(manualProfile.lastVerifiedAt, getManualStaleAfterMs("telegram"))
  ) {
    details.push("Цена давно не подтверждалась. Нужен review.");
  }

  return details;
}

function buildTelegramQuote(input: SaasPriceEnginePositionInput): SaasResolvedPriceQuote {
  const manualProfile = extractManualAssetProfile(input.metadata);
  const price = input.manualCurrentPrice ?? input.currentPrice ?? input.averageEntryPrice ?? null;
  const sourceId =
    input.manualCurrentPrice !== null
      ? "telegram_manual_otc"
      : input.currentPrice !== null
        ? "imported_price"
        : input.averageEntryPrice !== null
          ? "entry_price_fallback"
          : "telegram_missing";
  const staleAfterMs = getManualStaleAfterMs(input.category);
  const isReviewOverdue = isTimestampStale(
    manualProfile.lastVerifiedAt ?? input.updatedAt,
    staleAfterMs,
  );

  return {
    positionId: input.positionId,
    assetId: input.assetId,
    category: input.category,
    price,
    currency: input.baseCurrency,
    sourceId,
    sourceLabel:
      sourceId === "telegram_manual_otc"
        ? "Manual Telegram OTC"
        : sourceId === "imported_price"
          ? "Imported price"
          : sourceId === "entry_price_fallback"
            ? "Entry price fallback"
            : "Missing price",
    snapshotSource: sourceId === "imported_price" ? "IMPORTED" : "MANUAL",
    confidenceStatus: deriveManualPriceConfidenceStatus({
      metadata: input.metadata,
      fallbackUpdatedAt: input.updatedAt,
      staleAfterMs,
      hasPrice: price !== null,
    }),
    isLive: false,
    ttlSeconds: getSaasTelegramTtlSeconds(),
    capturedAt: buildSnapshotCapturedAt(getSaasTelegramTtlSeconds()),
    lastUpdated: manualProfile.lastVerifiedAt ?? manualProfile.lastEditedAt ?? input.updatedAt,
    warning:
      price === null
        ? "Telegram gift has no OTC/manual price."
        : isReviewOverdue
          ? "Telegram quote review is overdue. Update OTC price manually."
          : null,
    details: price === null ? buildUnknownDetails(input.assetName) : buildTelegramDetails(input),
  };
}

export function createSaasTelegramPriceProvider(): SaasPriceProvider {
  return {
    id: "saas_telegram",
    sourceName: "SaaS Telegram Manual Provider",
    categories: ["telegram"],
    ttlSeconds: getSaasTelegramTtlSeconds(),
    async resolve(inputs: SaasPriceEnginePositionInput[]): Promise<SaasPriceProviderResult> {
      const quotes = new Map<string, SaasResolvedPriceQuote>();

      for (const input of inputs) {
        quotes.set(input.positionId, buildTelegramQuote(input));
      }

      return {
        quotes,
        warnings: [],
      };
    },
  };
}
