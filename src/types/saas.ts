import type {
  AllocationDatum,
  CategoryPerformanceDatum,
  SummaryCardDatum,
} from "@/types/portfolio";

export type SaasWorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type SaasPortfolioVisibility = "private" | "shared_link" | "workspace";
export type SaasAssetCategory = "cs2" | "telegram" | "crypto" | "custom" | "nft";

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
  integrationSummary: {
    id: string;
    name: string;
    type: string;
    mode: string;
    status: string;
    lastSyncedAt: string | null;
  }[];
};
