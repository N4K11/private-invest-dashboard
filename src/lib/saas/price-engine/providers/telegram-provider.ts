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
} from "@/lib/saas/price-engine/utils";

function buildTelegramQuote(input: SaasPriceEnginePositionInput): SaasResolvedPriceQuote {
  const price = input.manualCurrentPrice ?? input.currentPrice ?? input.averageEntryPrice ?? null;
  const sourceId =
    input.manualCurrentPrice !== null
      ? "telegram_manual_otc"
      : input.currentPrice !== null
        ? "imported_price"
        : input.averageEntryPrice !== null
          ? "entry_price_fallback"
          : "telegram_missing";

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
      staleAfterMs: getManualStaleAfterMs(input.category),
      hasPrice: price !== null,
    }),
    isLive: false,
    ttlSeconds: getSaasTelegramTtlSeconds(),
    capturedAt: buildSnapshotCapturedAt(getSaasTelegramTtlSeconds()),
    lastUpdated: input.updatedAt,
    warning: price === null ? "Telegram gift has no OTC/manual price." : null,
    details: price === null ? buildUnknownDetails(input.assetName) : ["Manual/OTC Telegram price used."],
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
