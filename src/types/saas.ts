import type {
  AllocationDatum,
  AssetClassHistoryDatum,
  CategoryPerformanceDatum,
  PortfolioPnlHistoryDatum,
  PortfolioValueHistoryDatum,
  SummaryCardDatum,
} from "@/types/portfolio";

export type SaasWorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type SaasPortfolioVisibility = "private" | "shared_link" | "workspace";
export type SaasAssetCategory = "cs2" | "telegram" | "crypto" | "custom" | "nft";
export type SaasManualAssetCategory = "cs2" | "telegram" | "crypto" | "custom";
export type SaasManualAssetLiquidity = "high" | "medium" | "low" | "unknown";
export type SaasManualAssetConfidence = "high" | "medium" | "low";
export type SaasManualTransactionMode = "buy" | "sell" | "adjustment";
export type SaasTelegramPriceSource =
  | "fragment"
  | "otc_deal"
  | "marketplace_listing"
  | "manual_estimate";
export type SaasPriceConfidenceStatus =
  | "live_high"
  | "live_medium"
  | "manual_high"
  | "manual_low"
  | "stale"
  | "unknown";
export type SaasAnalyticsRiskFlag =
  | "concentration"
  | "stale_price"
  | "low_confidence"
  | "missing_price"
  | "negative_pnl"
  | "low_liquidity";

export type SaasWorkspaceMembership = {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  role: SaasWorkspaceRole;
  defaultCurrency: string;
  timezone: string;
  portfolioCount: number;
  memberCount: number;
  integrationCount: number;
  isActive: boolean;
};

export type SaasWorkspaceOverview = {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  defaultCurrency: string;
  timezone: string;
  role: SaasWorkspaceRole;
  memberCount: number;
  portfolioCount: number;
  integrationCount: number;
  positionCount: number;
  transactionCount: number;
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  lastActivityAt: string | null;
  recentPortfolios: SaasPortfolioListItem[];
};

export type SaasPortfolioListItem = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  visibility: SaasPortfolioVisibility;
  baseCurrency: string;
  riskProfile: string | null;
  updatedAt: string;
  createdAt: string;
  positionCount: number;
  transactionCount: number;
  integrationCount: number;
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  categories: SaasAssetCategory[];
};

export type SaasPortfolioPositionRow = {
  id: string;
  assetId: string;
  assetName: string;
  symbol: string | null;
  category: SaasAssetCategory;
  quantity: number;
  averageEntryPrice: number | null;
  currentPrice: number | null;
  manualCurrentPrice: number | null;
  currency: string | null;
  tags: string[];
  liquidity: SaasManualAssetLiquidity | null;
  confidence: SaasManualAssetConfidence | null;
  manualPriceSource: SaasTelegramPriceSource | null;
  lastVerifiedAt: string | null;
  priceNotes: string | null;
  priceConfidenceStatus: SaasPriceConfidenceStatus;
  priceUpdatedAt: string | null;
  priceWarning: string | null;
  totalValue: number;
  totalCost: number;
  pnl: number;
  priceSource: string | null;
  status: string;
  integrationName: string | null;
  updatedAt: string;
  notes: string | null;
};

export type SaasPortfolioTransactionRow = {
  id: string;
  action: string;
  occurredAt: string;
  assetName: string;
  category: SaasAssetCategory;
  quantity: number | null;
  unitPrice: number | null;
  fees: number | null;
  currency: string | null;
  notes: string | null;
};

export type SaasTelegramGiftPriceHistoryRow = {
  id: string;
  occurredAt: string;
  price: number | null;
  currency: string | null;
  confidence: SaasManualAssetConfidence | null;
  priceSource: SaasTelegramPriceSource | null;
  lastVerifiedAt: string | null;
  notes: string | null;
  previousPrice: number | null;
  changePercent: number | null;
  isOutlier: boolean;
  outlierMessage: string | null;
};

export type SaasTelegramGiftPricingRow = {
  positionId: string;
  assetId: string;
  assetName: string;
  quantity: number;
  currentPrice: number | null;
  currency: string;
  totalValue: number;
  confidence: SaasManualAssetConfidence | null;
  priceSource: SaasTelegramPriceSource | null;
  lastVerifiedAt: string | null;
  notes: string | null;
  needsReview: boolean;
  reviewReason: string | null;
  latestOutlierMessage: string | null;
  history: SaasTelegramGiftPriceHistoryRow[];
};

export type SaasPortfolioAnalyticsPosition = {
  positionId: string;
  assetId: string;
  assetName: string;
  category: SaasAssetCategory;
  value: number;
  weight: number;
  totalPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  roi: number | null;
  priceConfidenceStatus: SaasPriceConfidenceStatus;
  liquidity: SaasManualAssetLiquidity | null;
  riskFlags: SaasAnalyticsRiskFlag[];
  explainability: string[];
};

export type SaasPortfolioAnalytics = {
  cards: SummaryCardDatum[];
  realizedPnl: number;
  unrealizedPnl: number;
  totalRoi: number | null;
  winPositions: number;
  lossPositions: number;
  stalePriceCount: number;
  lowConfidenceValuationCount: number;
  concentrationRisk: {
    maxPositionWeight: number;
    topThreeWeight: number;
    summary: string;
  };
  topPositions: SaasPortfolioAnalyticsPosition[];
  riskWatchlist: SaasPortfolioAnalyticsPosition[];
  totalValueHistory: PortfolioValueHistoryDatum[];
  assetClassHistory: AssetClassHistoryDatum[];
  totalPnlHistory: PortfolioPnlHistoryDatum[];
  warnings: string[];
};

export type SaasPortfolioDetail = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  name: string;
  slug: string;
  visibility: SaasPortfolioVisibility;
  baseCurrency: string;
  riskProfile: string | null;
  role: SaasWorkspaceRole;
  canManage: boolean;
  isArchived: boolean;
  updatedAt: string;
  createdAt: string;
  integrationCount: number;
  positionCount: number;
  transactionCount: number;
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  roi: number | null;
  cards: SummaryCardDatum[];
  allocation: AllocationDatum[];
  categoryPerformance: CategoryPerformanceDatum[];
  positions: SaasPortfolioPositionRow[];
  recentTransactions: SaasPortfolioTransactionRow[];
  warnings: string[];
  analytics: SaasPortfolioAnalytics;
  telegramPricing: {
    positionCount: number;
    totalValue: number;
    staleCount: number;
    lowConfidenceCount: number;
    outlierCount: number;
    gifts: SaasTelegramGiftPricingRow[];
  };
  integrationSummary: {
    id: string;
    name: string;
    type: string;
    mode: string;
    status: string;
    lastSyncedAt: string | null;
  }[];
};
