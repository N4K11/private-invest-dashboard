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
  getSaasCustomTtlSeconds,
} from "@/lib/saas/price-engine/utils";

function buildCustomQuote(input: SaasPriceEnginePositionInput): SaasResolvedPriceQuote {
  const price = input.manualCurrentPrice ?? input.currentPrice ?? input.averageEntryPrice ?? null;
  const sourceId =
    input.manualCurrentPrice !== null
      ? "custom_manual"
      : input.currentPrice !== null
        ? "imported_price"
        : input.averageEntryPrice !== null
          ? "entry_price_fallback"
          : "custom_missing";

  return {
    positionId: input.positionId,
    assetId: input.assetId,
    category: input.category,
    price,
    currency: input.baseCurrency,
    sourceId,
    sourceLabel:
      sourceId === "custom_manual"
        ? "Manual Custom"
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
    ttlSeconds: getSaasCustomTtlSeconds(),
    capturedAt: buildSnapshotCapturedAt(getSaasCustomTtlSeconds()),
    warning: price === null ? "Custom asset has no manual price." : null,
    details: price === null ? buildUnknownDetails(input.assetName) : ["Manual custom price used."],
  };
}

export function createSaasCustomPriceProvider(): SaasPriceProvider {
  return {
    id: "saas_custom",
    sourceName: "SaaS Custom Manual Provider",
    categories: ["custom", "nft"],
    ttlSeconds: getSaasCustomTtlSeconds(),
    async resolve(inputs: SaasPriceEnginePositionInput[]): Promise<SaasPriceProviderResult> {
      const quotes = new Map<string, SaasResolvedPriceQuote>();

      for (const input of inputs) {
        quotes.set(input.positionId, buildCustomQuote(input));
      }

      return {
        quotes,
        warnings: [],
      };
    },
  };
}