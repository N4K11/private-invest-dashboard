import { getEnv } from "@/lib/env";
import { getConfiguredCs2Providers } from "@/lib/providers/cs2/provider-registry";
import type {
  Cs2MarketLiquidity,
  Cs2ProviderId,
  Cs2ResolvedPriceQuote,
} from "@/lib/providers/cs2/types";
import {
  canonicalizeCs2AssetName,
  extractCs2WearFromName,
  normalizeCs2LiquidityLabel,
} from "@/lib/providers/cs2/utils";
import type { NormalizedCs2Row } from "@/lib/sheets/normalizers";
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
  getManualTimestamp,
  getSaasCs2TtlSeconds,
  isTimestampStale,
  mapSourceIdToSnapshotSource,
  normalizePriceSourceLabel,
  toJsonRecord,
} from "@/lib/saas/price-engine/utils";
import type { Cs2AssetType, SheetRowRef } from "@/types/portfolio";

function buildSyntheticSheetRef(index: number): SheetRowRef {
  return {
    sheetName: "SaaS_CS2_Positions",
    rowNumber: index + 1,
    isCanonical: true,
  };
}

function inferCs2Type(input: SaasPriceEnginePositionInput): Cs2AssetType {
  const metadata = toJsonRecord(input.metadata);
  const manualAsset = toJsonRecord(metadata.manualAsset);
  const importMeta = toJsonRecord(metadata.import);
  const explicitType =
    typeof manualAsset.assetType === "string"
      ? manualAsset.assetType
      : typeof importMeta.assetType === "string"
        ? importMeta.assetType
        : null;
  const normalizedType = explicitType?.trim().toLowerCase();
  if (
    normalizedType === "stickers" ||
    normalizedType === "skins" ||
    normalizedType === "cases" ||
    normalizedType === "charms" ||
    normalizedType === "graffiti" ||
    normalizedType === "other"
  ) {
    return normalizedType;
  }

  const lowerName = input.assetName.toLowerCase();
  if (lowerName.includes("sticker")) {
    return "stickers";
  }
  if (lowerName.includes("graffiti")) {
    return "graffiti";
  }
  if (lowerName.includes("charm")) {
    return "charms";
  }
  if (
    lowerName.includes("case") ||
    lowerName.includes("capsule") ||
    lowerName.includes("package") ||
    lowerName.includes("souvenir package")
  ) {
    return "cases";
  }

  return "skins";
}

function mapManualLiquidity(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function buildLegacyCs2Row(
  input: SaasPriceEnginePositionInput,
  index: number,
): NormalizedCs2Row {
  const metadata = toJsonRecord(input.metadata);
  const manualAsset = toJsonRecord(metadata.manualAsset);
  const wear =
    typeof manualAsset.wear === "string"
      ? manualAsset.wear
      : extractCs2WearFromName(input.assetName);
  const canonicalName = canonicalizeCs2AssetName(input.assetName, wear);

  return {
    id: input.positionId,
    name: canonicalName,
    type: inferCs2Type(input),
    quantity: input.quantity,
    wear,
    averageEntryPrice: input.averageEntryPrice,
    manualCurrentPrice: input.manualCurrentPrice,
    currentPrice: input.currentPrice,
    sheetPriceSource: input.currentPrice !== null ? "imported_price" : null,
    currency: input.baseCurrency,
    status: null,
    category: null,
    lastUpdated: getManualTimestamp(input.metadata, input.updatedAt),
    notes: null,
    market: null,
    manualRiskScore: null,
    liquidityLabel: mapManualLiquidity(manualAsset.liquidity),
    sheetRef: buildSyntheticSheetRef(index),
  };
}

function pricesRoughlyEqual(left: number | null, right: number | null) {
  if (left === null || right === null) {
    return false;
  }

  return Math.abs(left - right) < 0.0001;
}

function mapLegacySourceToSaasSourceId(
  quote: Cs2ResolvedPriceQuote,
  input: SaasPriceEnginePositionInput,
) {
  if (quote.sourceId === "steam") {
    return "steam_market_live";
  }

  if (quote.sourceId === "buff_proxy") {
    return "buff_proxy_live";
  }

  if (quote.sourceId === "csfloat") {
    return "csfloat_live";
  }

  if (quote.sourceId === "pricempire") {
    return "pricempire_live";
  }

  if (pricesRoughlyEqual(quote.price, input.manualCurrentPrice)) {
    return "cs2_manual";
  }

  if (pricesRoughlyEqual(quote.price, input.currentPrice)) {
    return "imported_price";
  }

  if (pricesRoughlyEqual(quote.price, input.averageEntryPrice)) {
    return "entry_price_fallback";
  }

  return "cs2_manual";
}

function parseCs2FxFallbackRates() {
  const rates: Record<string, number> = {
    USD: 1,
  };
  const raw = getEnv().CS2_FX_FALLBACK_RATES_JSON?.trim();

  if (!raw) {
    return {
      rates,
      warning: null as string | null,
    };
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const [currency, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        rates[currency.trim().toUpperCase()] = value;
      }
    }

    return {
      rates,
      warning: null as string | null,
    };
  } catch {
    return {
      rates,
      warning:
        "CS2_FX_FALLBACK_RATES_JSON содержит невалидный JSON. Конвертация не-USD котировок CS2 будет недоступна.",
    };
  }
}

function convertPriceToTargetCurrency(options: {
  amount: number | null;
  sourceCurrency: string | null;
  targetCurrency: string;
  rates: Record<string, number>;
}) {
  if (options.amount === null) {
    return {
      convertedPrice: null,
      detail: null as string | null,
      warning: null as string | null,
      marketCurrency: options.sourceCurrency?.trim().toUpperCase() ?? null,
    };
  }

  const targetCurrency = options.targetCurrency.trim().toUpperCase();
  const sourceCurrency = options.sourceCurrency?.trim().toUpperCase() ?? targetCurrency;

  if (sourceCurrency === targetCurrency) {
    return {
      convertedPrice: options.amount,
      detail: null as string | null,
      warning: null as string | null,
      marketCurrency: sourceCurrency,
    };
  }

  const sourceRate = options.rates[sourceCurrency];
  const targetRate = options.rates[targetCurrency];

  if (!sourceRate || !targetRate) {
    return {
      convertedPrice: null,
      detail: null as string | null,
      warning:
        `Нет FX fallback rate для конвертации CS2 quotes ${sourceCurrency} -> ${targetCurrency}. ` +
        "Добавьте CS2_FX_FALLBACK_RATES_JSON или используйте USD как base currency.",
      marketCurrency: sourceCurrency,
    };
  }

  return {
    convertedPrice: (options.amount * sourceRate) / targetRate,
    detail: `Converted from ${sourceCurrency} to ${targetCurrency} using CS2_FX_FALLBACK_RATES_JSON.`,
    warning: null as string | null,
    marketCurrency: sourceCurrency,
  };
}

function mapLegacyLiquidityToSaas(value: Cs2MarketLiquidity | null | undefined) {
  if (value === "high" || value === "medium" || value === "low" || value === "unknown") {
    return value;
  }

  return null;
}

function buildManualOrMissingQuote(
  input: SaasPriceEnginePositionInput,
  warningPrefix?: string | null,
): SaasResolvedPriceQuote {
  const manualPrice = input.manualCurrentPrice ?? input.currentPrice ?? input.averageEntryPrice ?? null;
  const sourceId =
    input.manualCurrentPrice !== null
      ? "cs2_manual"
      : input.currentPrice !== null
        ? "imported_price"
        : input.averageEntryPrice !== null
          ? "entry_price_fallback"
          : "cs2_missing";
  const lastUpdated = getManualTimestamp(input.metadata, input.updatedAt);
  const manualWarning = manualPrice === null ? "CS2 position has no live or fallback price." : null;
  const warning = [warningPrefix, manualWarning].filter(Boolean).join(" ") || null;

  return {
    positionId: input.positionId,
    assetId: input.assetId,
    category: input.category,
    price: manualPrice,
    currency: input.baseCurrency,
    sourceId,
    sourceLabel: normalizePriceSourceLabel(sourceId),
    snapshotSource: sourceId === "imported_price" ? "IMPORTED" : "MANUAL",
    confidenceStatus: deriveManualPriceConfidenceStatus({
      metadata: input.metadata,
      fallbackUpdatedAt: lastUpdated,
      staleAfterMs: getManualStaleAfterMs(input.category),
      hasPrice: manualPrice !== null,
    }),
    isLive: false,
    ttlSeconds: getSaasCs2TtlSeconds(),
    capturedAt: buildSnapshotCapturedAt(getSaasCs2TtlSeconds()),
    lastUpdated,
    warning,
    details:
      manualPrice === null
        ? buildUnknownDetails(input.assetName)
        : ["Manual/imported CS2 fallback used."],
    liquidityEstimate:
      normalizeCs2LiquidityLabel(
        typeof toJsonRecord(toJsonRecord(input.metadata).manualAsset).liquidity === "string"
          ? String(toJsonRecord(toJsonRecord(input.metadata).manualAsset).liquidity)
          : null,
      ) ?? null,
    metadata: {
      canonicalName: canonicalizeCs2AssetName(input.assetName),
    },
  };
}

function resolveQuoteCurrency(
  quote: Cs2ResolvedPriceQuote,
  input: SaasPriceEnginePositionInput,
) {
  if (quote.currency) {
    return quote.currency;
  }

  if (quote.sourceId === "steam") {
    return "USD";
  }

  if (quote.sourceId === "buff_proxy") {
    return input.baseCurrency;
  }

  return input.baseCurrency;
}

function buildConfidenceStatus(
  quote: Cs2ResolvedPriceQuote,
  input: SaasPriceEnginePositionInput,
) {
  if (!quote.isLive) {
    return deriveManualPriceConfidenceStatus({
      metadata: input.metadata,
      fallbackUpdatedAt: quote.lastUpdated ?? input.updatedAt,
      staleAfterMs: getManualStaleAfterMs(input.category),
      hasPrice: quote.price !== null,
    });
  }

  if (isTimestampStale(quote.lastUpdated ?? input.updatedAt, getManualStaleAfterMs(input.category))) {
    return "stale";
  }

  return quote.confidence === "high" ? "live_high" : "live_medium";
}

function mapLegacyQuoteToSaasQuote(options: {
  input: SaasPriceEnginePositionInput;
  quote: Cs2ResolvedPriceQuote;
  rates: Record<string, number>;
}) {
  const { input, quote, rates } = options;
  const sourceId = mapLegacySourceToSaasSourceId(quote, input);
  const sourceCurrency = resolveQuoteCurrency(quote, input);
  const conversion = convertPriceToTargetCurrency({
    amount: quote.price,
    sourceCurrency,
    targetCurrency: input.baseCurrency,
    rates,
  });

  if (quote.price !== null && conversion.convertedPrice === null) {
    return buildManualOrMissingQuote(input, `${quote.sourceName}: ${conversion.warning}`);
  }

  const stale = isTimestampStale(quote.lastUpdated ?? input.updatedAt, getManualStaleAfterMs(input.category));
  const warning = [
    quote.warning,
    stale ? (quote.isLive ? "CS2 live quote устарела и требует проверки источника." : "CS2 manual quote устарела.") : null,
  ]
    .filter(Boolean)
    .join(" ") || null;
  const details = [
    quote.canonicalName ? `Canonical name: ${quote.canonicalName}.` : null,
    quote.matchedName ? `Matched market name: ${quote.matchedName}.` : null,
    conversion.detail,
    quote.sourceId === "buff_proxy" && !quote.currency
      ? `Proxy quote was assumed to be in ${input.baseCurrency}.`
      : null,
  ].filter((value): value is string => Boolean(value));

  return {
    positionId: input.positionId,
    assetId: input.assetId,
    category: input.category,
    price: conversion.convertedPrice,
    currency: input.baseCurrency,
    sourceId,
    sourceLabel: normalizePriceSourceLabel(sourceId),
    snapshotSource: mapSourceIdToSnapshotSource(
      sourceId,
      sourceId === "imported_price" ? "IMPORTED" : quote.isLive ? "IMPORTED" : "MANUAL",
    ),
    confidenceStatus: buildConfidenceStatus(quote, input),
    isLive: quote.isLive,
    ttlSeconds: getSaasCs2TtlSeconds(),
    capturedAt: buildSnapshotCapturedAt(getSaasCs2TtlSeconds()),
    lastUpdated: quote.lastUpdated ?? input.updatedAt,
    warning,
    details: details.length > 0 ? details : ["CS2 quote resolved from provider chain."],
    liquidityEstimate: mapLegacyLiquidityToSaas(quote.liquidityLabel),
    metadata: {
      providerId: quote.sourceId as Cs2ProviderId,
      sourceCurrency: conversion.marketCurrency,
      matchedName: quote.matchedName,
      canonicalName: quote.canonicalName,
      liquidityDepth: quote.liquidityDepth,
      liquidityLabel: quote.liquidityLabel,
    },
  } satisfies SaasResolvedPriceQuote;
}

export function createSaasCs2PriceProvider(): SaasPriceProvider {
  return {
    id: "saas_cs2",
    sourceName: "SaaS CS2 Provider Chain",
    categories: ["cs2"],
    ttlSeconds: getSaasCs2TtlSeconds(),
    async resolve(inputs: SaasPriceEnginePositionInput[]): Promise<SaasPriceProviderResult> {
      const quotes = new Map<string, SaasResolvedPriceQuote>();
      const { rates, warning: fxWarning } = parseCs2FxFallbackRates();
      const { providers, warnings: registryWarnings } = getConfiguredCs2Providers();
      const warnings = [...registryWarnings];
      const lookups = inputs.map((input, index) => ({
        input,
        assetId: input.positionId,
        row: buildLegacyCs2Row(input, index),
      }));
      const resolvedQuotes = new Map<string, Cs2ResolvedPriceQuote>();
      let unresolvedLookups = lookups;

      if (providers.length > 0) {
        warnings.push(
          `SaaS CS2 provider chain: ${providers.map((provider) => provider.sourceName).join(" -> ")}.`,
        );
      }

      if (fxWarning) {
        warnings.push(fxWarning);
      }

      for (const provider of providers) {
        if (unresolvedLookups.length === 0) {
          break;
        }

        const result = await provider.getBulkPrices(
          unresolvedLookups.map((lookup) => ({
            assetId: lookup.assetId,
            assetName: lookup.input.assetName,
            row: lookup.row,
          })),
        );
        warnings.push(...result.warnings);

        for (const lookup of unresolvedLookups) {
          const quote = result.quotes.get(lookup.assetId);
          if (quote && quote.price !== null) {
            resolvedQuotes.set(lookup.assetId, quote);
          }
        }

        unresolvedLookups = unresolvedLookups.filter((lookup) => !resolvedQuotes.has(lookup.assetId));
      }

      for (const input of inputs) {
        const legacyQuote = resolvedQuotes.get(input.positionId) ?? null;
        if (!legacyQuote) {
          quotes.set(input.positionId, buildManualOrMissingQuote(input));
          continue;
        }

        quotes.set(
          input.positionId,
          mapLegacyQuoteToSaasQuote({
            input,
            quote: legacyQuote,
            rates,
          }),
        );
      }

      const liveCount = [...quotes.values()].filter((quote) => quote.isLive).length;
      const staleCount = [...quotes.values()].filter((quote) => quote.confidenceStatus === "stale").length;
      const missingCount = [...quotes.values()].filter((quote) => quote.confidenceStatus === "unknown").length;

      if (liveCount > 0) {
        warnings.push(`SaaS CS2 live coverage: ${liveCount}/${inputs.length} positions.`);
      }

      if (staleCount > 0) {
        warnings.push(`SaaS CS2 stale-price warnings: ${staleCount}.`);
      }

      if (missingCount > 0) {
        warnings.push(`SaaS CS2 positions without usable price: ${missingCount}.`);
      }

      return {
        quotes,
        warnings,
      };
    },
  };
}
