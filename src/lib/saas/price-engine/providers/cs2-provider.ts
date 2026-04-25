import { getEnv } from "@/lib/env";
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
  getSaasCs2TtlSeconds,
} from "@/lib/saas/price-engine/utils";

function buildManualCs2Quote(input: SaasPriceEnginePositionInput): SaasResolvedPriceQuote {
  const price = input.manualCurrentPrice ?? input.currentPrice ?? input.averageEntryPrice ?? null;
  const sourceId =
    input.manualCurrentPrice !== null
      ? "cs2_manual"
      : input.currentPrice !== null
        ? "imported_price"
        : input.averageEntryPrice !== null
          ? "entry_price_fallback"
          : "cs2_missing";

  return {
    positionId: input.positionId,
    assetId: input.assetId,
    category: input.category,
    price,
    currency: input.baseCurrency,
    sourceId,
    sourceLabel:
      sourceId === "cs2_manual"
        ? "Manual CS2"
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
    ttlSeconds: getSaasCs2TtlSeconds(),
    capturedAt: buildSnapshotCapturedAt(getSaasCs2TtlSeconds()),
    warning: price === null ? "CS2 position has no manual or fallback price." : null,
    details: price === null ? buildUnknownDetails(input.assetName) : ["Manual/mock CS2 price used."],
    metadata: {
      adapterSlots: getEnv().CS2_PROVIDER_ORDER,
    },
  };
}

export function createSaasCs2PriceProvider(): SaasPriceProvider {
  return {
    id: "saas_cs2",
    sourceName: "SaaS CS2 Manual Provider",
    categories: ["cs2"],
    ttlSeconds: getSaasCs2TtlSeconds(),
    async resolve(inputs: SaasPriceEnginePositionInput[]): Promise<SaasPriceProviderResult> {
      const quotes = new Map<string, SaasResolvedPriceQuote>();

      for (const input of inputs) {
        quotes.set(input.positionId, buildManualCs2Quote(input));
      }

      const configuredSlots = getEnv().CS2_PROVIDER_ORDER.split(",").map((item) => item.trim()).filter(Boolean);
      const adapterSlots = configuredSlots.filter((item) => item !== "manual");

      return {
        quotes,
        warnings:
          adapterSlots.length > 0
            ? [`CS2 SaaS provider is using manual/mock pricing. Adapter slots reserved for future stages: ${adapterSlots.join(", ")}.`]
            : [],
      };
    },
  };
}