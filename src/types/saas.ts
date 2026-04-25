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
export type SaasAlertRuleType =
  | "price_above"
  | "price_below"
  | "portfolio_value_change"
  | "stale_price"
  | "concentration_risk";
export type SaasAlertRuleStatus = "active" | "paused";
export type SaasAlertChannel = "email";
export type SaasAlertEventStatus =
  | "triggered"
  | "delivered"
  | "failed"
  | "skipped"
  | "dismissed";
export type SaasAlertDirection = "up" | "down" | "either";

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
export type SaasSubscriptionPlan = "free" | "pro" | "whale" | "team";
export type SaasSubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";
export type SaasUsageLimitKey =
  | "portfolios"
  | "positions"
  | "integrations"
  | "alerts";

export type SaasBillingUsageMetric = {
  key: SaasUsageLimitKey;
  label: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  unit: string;
  utilizationPercent: number | null;
  isNearLimit: boolean;
  isExceeded: boolean;
};

export type SaasWorkspaceLimitEnvelope = {
  portfolios: number | null;
  positions: number | null;
  integrations: number | null;
  priceRefreshHours: number | null;
  alerts: number | null;
  historyRetentionDays: number | null;
};

export type SaasWorkspaceLimitOverrides = {
  enabled: boolean;
  portfolios: number | null;
  positions: number | null;
  integrations: number | null;
  priceRefreshHours: number | null;
  alerts: number | null;
  historyRetentionDays: number | null;
  notes: string | null;
  isAnyApplied: boolean;
};

export type SaasWorkspaceLimitSnapshot = {
  workspaceId: string;
  plan: SaasSubscriptionPlan;
  status: SaasSubscriptionStatus;
  effectiveLimits: SaasWorkspaceLimitEnvelope;
  usage: SaasBillingUsageMetric[];
  overrides: SaasWorkspaceLimitOverrides;
  warnings: string[];
};

export type SaasBillingPlanCard = {
  plan: SaasSubscriptionPlan;
  label: string;
  description: string;
  monthlyPriceUsd: number;
  seatsIncluded: number;
  highlights: string[];
  limits: SaasWorkspaceLimitEnvelope;
  stripePriceConfigured: boolean;
  isCurrent: boolean;
  canCheckout: boolean;
};

export type SaasWorkspaceBillingSummary = {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  role: SaasWorkspaceRole;
  canManage: boolean;
  providerConfigured: boolean;
  webhookConfigured: boolean;
  customerPortalReady: boolean;
  currentSubscription: {
    plan: SaasSubscriptionPlan;
    status: SaasSubscriptionStatus;
    billingProvider: string | null;
    billingCustomerId: string | null;
    billingSubscriptionId: string | null;
    seatCount: number;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
    cancelAtPeriodEnd: boolean;
    overrideLimitsEnabled: boolean;
    overrideNotes: string | null;
  };
  usage: SaasBillingUsageMetric[];
  limits: SaasWorkspaceLimitSnapshot;
  plans: SaasBillingPlanCard[];
  warnings: string[];
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
  insights: SaasPortfolioInsights;
  limits: SaasWorkspaceLimitSnapshot;
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

export type SaasPortfolioInsightCategory =
  | "summary"
  | "risk"
  | "liquidity"
  | "concentration"
  | "change"
  | "valuation";
export type SaasPortfolioInsightTone = "neutral" | "positive" | "warning" | "critical";

export type SaasPortfolioInsightMetric = {
  label: string;
  value: string;
};

export type SaasPortfolioInsightItem = {
  id: string;
  category: SaasPortfolioInsightCategory;
  tone: SaasPortfolioInsightTone;
  title: string;
  summary: string;
  details: string[];
  metrics: SaasPortfolioInsightMetric[];
};

export type SaasPortfolioInsightSection = {
  id: string;
  title: string;
  description: string;
  items: SaasPortfolioInsightItem[];
};

export type SaasPortfolioInsights = {
  providerId: string;
  deterministic: boolean;
  generatedAt: string;
  headline: string;
  disclaimer: string;
  sections: SaasPortfolioInsightSection[];
};

export type SaasAlertPortfolioOption = {
  id: string;
  name: string;
  baseCurrency: string;
  assetCount: number;
};

export type SaasAlertAssetOption = {
  assetId: string;
  portfolioId: string;
  assetName: string;
  symbol: string | null;
  category: SaasAssetCategory;
};

export type SaasAlertRuleRow = {
  id: string;
  workspaceId: string;
  portfolioId: string | null;
  portfolioName: string | null;
  assetId: string | null;
  assetName: string | null;
  assetSymbol: string | null;
  type: SaasAlertRuleType;
  name: string;
  status: SaasAlertRuleStatus;
  channel: SaasAlertChannel;
  thresholdValue: number | null;
  thresholdPercent: number | null;
  cooldownMinutes: number;
  recipientEmail: string | null;
  direction: SaasAlertDirection;
  createdAt: string;
  updatedAt: string;
  lastEvaluatedAt: string | null;
  lastTriggeredAt: string | null;
};

export type SaasAlertEventRow = {
  id: string;
  ruleId: string | null;
  ruleName: string | null;
  type: SaasAlertRuleType;
  status: SaasAlertEventStatus;
  channel: SaasAlertChannel;
  title: string;
  message: string;
  recipientEmail: string | null;
  metricValue: number | null;
  thresholdValue: number | null;
  triggeredAt: string;
  deliveredAt: string | null;
  portfolioId: string | null;
  portfolioName: string | null;
  assetId: string | null;
  assetName: string | null;
  assetSymbol: string | null;
};

export type SaasAlertsEvaluationResult = {
  checkedRules: number;
  triggeredRules: number;
  deliveredEvents: number;
  failedEvents: number;
  skippedEvents: number;
  suppressedByCooldown: number;
  events: SaasAlertEventRow[];
};

export type SaasAlertsWorkspaceView = {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  defaultCurrency: string;
  role: SaasWorkspaceRole;
  canManage: boolean;
  defaultRecipientEmail: string | null;
  portfolios: SaasAlertPortfolioOption[];
  assets: SaasAlertAssetOption[];
  rules: SaasAlertRuleRow[];
  events: SaasAlertEventRow[];
  limits: SaasWorkspaceLimitSnapshot;
};
