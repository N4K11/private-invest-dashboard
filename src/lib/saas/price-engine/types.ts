import type { PriceSourceType, Prisma } from "@prisma/client";

import type { SaasAssetCategory, SaasPriceConfidenceStatus } from "@/types/saas";

export type SaasPriceEnginePositionInput = {
  portfolioId: string;
  positionId: string;
  assetId: string;
  assetName: string;
  symbol: string | null;
  category: SaasAssetCategory;
  quantity: number;
  averageEntryPrice: number | null;
  currentPrice: number | null;
  manualCurrentPrice: number | null;
  metadata: Prisma.JsonValue | null;
  updatedAt: string;
  baseCurrency: string;
};

export type SaasResolvedPriceQuote = {
  positionId: string;
  assetId: string;
  category: SaasAssetCategory;
  price: number | null;
  currency: string;
  sourceId: string;
  sourceLabel: string;
  snapshotSource: PriceSourceType;
  confidenceStatus: SaasPriceConfidenceStatus;
  isLive: boolean;
  ttlSeconds: number;
  capturedAt: string | null;
  lastUpdated: string | null;
  warning: string | null;
  details: string[];
  liquidityEstimate?: "high" | "medium" | "low" | "unknown" | null;
  metadata?: Record<string, unknown>;
};

export type SaasPriceProviderResult = {
  quotes: Map<string, SaasResolvedPriceQuote>;
  warnings: string[];
};

export interface SaasPriceProvider {
  id: string;
  sourceName: string;
  categories: SaasAssetCategory[];
  ttlSeconds: number;
  resolve(inputs: SaasPriceEnginePositionInput[]): Promise<SaasPriceProviderResult>;
}

export type SaasPortfolioPriceEngineResult = {
  quotes: Map<string, SaasResolvedPriceQuote>;
  warnings: string[];
  persistedSnapshots: number;
};
