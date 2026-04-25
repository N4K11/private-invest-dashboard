import "server-only";

import type { Prisma } from "@prisma/client";

import { extractManualAssetProfile } from "@/lib/saas/manual-assets";
import { resolveSaasPortfolioPrices } from "@/lib/saas/price-engine/engine";
import type { SaasResolvedPriceQuote } from "@/lib/saas/price-engine/types";
import {
  decimalToNumber,
  normalizeAssetCategory,
} from "@/lib/saas/utils";
import type {
  SaasPortfolioPositionRow,
  SaasPriceConfidenceStatus,
} from "@/types/saas";

export type PortfolioPositionForPricing = {
  id: string;
  assetId: string;
  quantity: Prisma.Decimal;
  averageEntryPrice: Prisma.Decimal | null;
  currentPrice: Prisma.Decimal | null;
  manualCurrentPrice: Prisma.Decimal | null;
  priceSource: string | null;
  status: string;
  notes: string | null;
  metadata: Prisma.JsonValue | null;
  updatedAt: Date;
  integration?: { name: string } | null;
  asset: {
    name: string;
    symbol: string | null;
    category: "CS2" | "TELEGRAM" | "CRYPTO" | "CUSTOM" | "NFT";
  };
};

export type PricedPortfolioPositions = {
  positions: SaasPortfolioPositionRow[];
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  warnings: string[];
  persistedSnapshots: number;
};

function getDisplayCurrentPrice(options: {
  rawCurrentPrice: number | null;
  resolvedQuote?: SaasResolvedPriceQuote;
}) {
  if (
    options.resolvedQuote?.price !== null &&
    options.resolvedQuote?.price !== undefined &&
    (options.resolvedQuote.isLive || options.rawCurrentPrice === null)
  ) {
    return options.resolvedQuote.price;
  }

  return options.rawCurrentPrice;
}

function getEffectiveCurrentPrice(options: {
  averageEntryPrice: number | null;
  rawCurrentPrice: number | null;
  manualCurrentPrice: number | null;
  resolvedQuote?: SaasResolvedPriceQuote;
}) {
  return (
    options.resolvedQuote?.price ??
    options.manualCurrentPrice ??
    options.rawCurrentPrice ??
    options.averageEntryPrice ??
    0
  );
}

function buildPositionRow(
  position: PortfolioPositionForPricing,
  baseCurrency: string,
  resolvedQuote: SaasResolvedPriceQuote | undefined,
): SaasPortfolioPositionRow {
  const quantity = decimalToNumber(position.quantity) ?? 0;
  const averageEntryPrice = decimalToNumber(position.averageEntryPrice);
  const rawCurrentPrice = decimalToNumber(position.currentPrice);
  const manualCurrentPrice = decimalToNumber(position.manualCurrentPrice);
  const manualProfile = extractManualAssetProfile(position.metadata);
  const effectiveCurrentPrice = getEffectiveCurrentPrice({
    averageEntryPrice,
    rawCurrentPrice,
    manualCurrentPrice,
    resolvedQuote,
  });
  const totalValue = quantity * effectiveCurrentPrice;
  const totalCost = quantity * (averageEntryPrice ?? 0);

  return {
    id: position.id,
    assetId: position.assetId,
    assetName: position.asset.name,
    symbol: position.asset.symbol,
    category: normalizeAssetCategory(position.asset.category),
    quantity,
    averageEntryPrice,
    currentPrice: getDisplayCurrentPrice({
      rawCurrentPrice,
      resolvedQuote,
    }),
    manualCurrentPrice,
    currency: resolvedQuote?.currency ?? manualProfile.currency ?? baseCurrency,
    tags: manualProfile.tags,
    liquidity: manualProfile.liquidity ?? resolvedQuote?.liquidityEstimate ?? null,
    confidence: manualProfile.confidence,
    manualPriceSource: manualProfile.priceSource,
    lastVerifiedAt: manualProfile.lastVerifiedAt,
    priceNotes: manualProfile.priceNotes,
    priceConfidenceStatus:
      resolvedQuote?.confidenceStatus ?? ("unknown" as SaasPriceConfidenceStatus),
    priceUpdatedAt:
      resolvedQuote?.lastUpdated ??
      resolvedQuote?.capturedAt ??
      manualProfile.lastEditedAt ??
      position.updatedAt.toISOString(),
    priceWarning: resolvedQuote?.warning ?? null,
    totalValue,
    totalCost,
    pnl: totalValue - totalCost,
    priceSource:
      resolvedQuote?.sourceId ??
      (position.priceSource ? position.priceSource.toLowerCase() : null),
    status: position.status.toLowerCase(),
    integrationName: position.integration?.name ?? null,
    updatedAt: position.updatedAt.toISOString(),
    notes: position.notes,
  };
}

export async function pricePortfolioPositions(options: {
  portfolioId: string;
  baseCurrency: string;
  positions: PortfolioPositionForPricing[];
}): Promise<PricedPortfolioPositions> {
  const priceEngineResult =
    options.positions.length > 0
      ? await resolveSaasPortfolioPrices({
          portfolioId: options.portfolioId,
          positions: options.positions.map((position) => {
            const manualProfile = extractManualAssetProfile(position.metadata);

            return {
              portfolioId: options.portfolioId,
              positionId: position.id,
              assetId: position.assetId,
              assetName: position.asset.name,
              symbol: position.asset.symbol,
              category: normalizeAssetCategory(position.asset.category),
              quantity: decimalToNumber(position.quantity) ?? 0,
              averageEntryPrice: decimalToNumber(position.averageEntryPrice),
              currentPrice: decimalToNumber(position.currentPrice),
              manualCurrentPrice: decimalToNumber(position.manualCurrentPrice),
              metadata: position.metadata,
              updatedAt: position.updatedAt.toISOString(),
              baseCurrency: manualProfile.currency ?? options.baseCurrency,
            };
          }),
        })
      : {
          quotes: new Map<string, SaasResolvedPriceQuote>(),
          warnings: [],
          persistedSnapshots: 0,
        };

  const positions = options.positions
    .map((position) =>
      buildPositionRow(
        position,
        options.baseCurrency,
        priceEngineResult.quotes.get(position.id),
      ),
    )
    .sort((left, right) => right.totalValue - left.totalValue);

  return {
    positions,
    totalValue: positions.reduce((sum, position) => sum + position.totalValue, 0),
    totalCost: positions.reduce((sum, position) => sum + position.totalCost, 0),
    totalPnl: positions.reduce((sum, position) => sum + position.pnl, 0),
    warnings: priceEngineResult.warnings,
    persistedSnapshots: priceEngineResult.persistedSnapshots,
  };
}




