import "server-only";

import { getPortfolioInsightsProvider } from "@/lib/saas/insights/provider";
import type {
  SafePortfolioInsightSnapshot,
  SafePortfolioInsightsContext,
} from "@/lib/saas/insights/types";
import type {
  SaasAssetCategory,
  SaasPortfolioAnalytics,
  SaasPortfolioInsights,
  SaasPortfolioPositionRow,
} from "@/types/saas";

type PortfolioInsightsSnapshotInput = {
  assetId: string;
  category: SaasAssetCategory;
  capturedAt: string;
  price: number;
};

type BuildPortfolioInsightsInput = {
  workspaceId: string;
  portfolioId: string;
  portfolioName: string;
  baseCurrency: string;
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  roi: number | null;
  positionCount: number;
  transactionCount: number;
  warnings: string[];
  analytics: SaasPortfolioAnalytics;
  positions: SaasPortfolioPositionRow[];
  snapshots: PortfolioInsightsSnapshotInput[];
};

function sanitizePositions(positions: SaasPortfolioPositionRow[]): SafePortfolioInsightsContext["positions"] {
  return positions.map((position) => ({
    positionId: position.id,
    assetId: position.assetId,
    assetName: position.assetName,
    symbol: position.symbol,
    category: position.category,
    quantity: position.quantity,
    totalValue: position.totalValue,
    totalCost: position.totalCost,
    pnl: position.pnl,
    priceConfidenceStatus: position.priceConfidenceStatus,
    priceUpdatedAt: position.priceUpdatedAt,
    priceWarning: position.priceWarning,
    liquidity: position.liquidity,
  }));
}

function sanitizeSnapshots(
  snapshots: PortfolioInsightsSnapshotInput[],
): SafePortfolioInsightSnapshot[] {
  return snapshots
    .filter((snapshot) => Number.isFinite(snapshot.price) && snapshot.price >= 0)
    .map((snapshot) => ({
      assetId: snapshot.assetId,
      category: snapshot.category,
      capturedAt: snapshot.capturedAt,
      price: snapshot.price,
    }));
}

export async function buildPortfolioInsights(
  input: BuildPortfolioInsightsInput,
): Promise<SaasPortfolioInsights> {
  const provider = getPortfolioInsightsProvider();

  return provider.buildInsights({
    workspaceId: input.workspaceId,
    portfolioId: input.portfolioId,
    portfolioName: input.portfolioName,
    baseCurrency: input.baseCurrency,
    generatedAt: new Date().toISOString(),
    totalValue: input.totalValue,
    totalCost: input.totalCost,
    totalPnl: input.totalPnl,
    roi: input.roi,
    positionCount: input.positionCount,
    transactionCount: input.transactionCount,
    warnings: [...input.warnings],
    analytics: input.analytics,
    positions: sanitizePositions(input.positions),
    snapshots: sanitizeSnapshots(input.snapshots),
  });
}