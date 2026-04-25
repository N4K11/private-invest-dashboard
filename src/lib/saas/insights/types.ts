import "server-only";

import type {
  SaasAssetCategory,
  SaasManualAssetLiquidity,
  SaasPortfolioAnalytics,
  SaasPortfolioInsights,
  SaasPriceConfidenceStatus,
} from "@/types/saas";

export type SafePortfolioInsightPosition = {
  positionId: string;
  assetId: string;
  assetName: string;
  symbol: string | null;
  category: SaasAssetCategory;
  quantity: number;
  totalValue: number;
  totalCost: number;
  pnl: number;
  priceConfidenceStatus: SaasPriceConfidenceStatus;
  priceUpdatedAt: string | null;
  priceWarning: string | null;
  liquidity: SaasManualAssetLiquidity | null;
};

export type SafePortfolioInsightSnapshot = {
  assetId: string;
  category: SaasAssetCategory;
  capturedAt: string;
  price: number;
};

export type SafePortfolioInsightsContext = {
  workspaceId: string;
  portfolioId: string;
  portfolioName: string;
  baseCurrency: string;
  generatedAt: string;
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  roi: number | null;
  positionCount: number;
  transactionCount: number;
  warnings: string[];
  analytics: SaasPortfolioAnalytics;
  positions: SafePortfolioInsightPosition[];
  snapshots: SafePortfolioInsightSnapshot[];
};

export type PortfolioInsightsProvider = {
  id: string;
  buildInsights(
    context: SafePortfolioInsightsContext,
  ): Promise<SaasPortfolioInsights> | SaasPortfolioInsights;
};