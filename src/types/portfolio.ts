export type AssetCategory = "cs2" | "telegram" | "crypto";

export type Cs2AssetType =
  | "stickers"
  | "skins"
  | "cases"
  | "charms"
  | "graffiti"
  | "other";

export type DataSourceMode = "live" | "fallback" | "demo";
export type QuantitySource = "sheet" | "transactions";
export type TransactionAction = "buy" | "sell" | "transfer" | "price_update" | "fee";
export type PriceConfidence = "high" | "medium" | "low";
export type Cs2PriceConfidence = PriceConfidence;
export type TelegramPriceConfidence = PriceConfidence;

export interface SheetRowRef {
  sheetName: string;
  rowNumber: number;
  isCanonical: boolean;
}

export interface CategoryBreakdown {
  category: AssetCategory;
  label: string;
  value: number;
  cost: number;
  pnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  fees: number;
  roi: number | null;
  positions: number;
  items: number;
  color: string;
}

export interface TopHolding {
  id: string;
  name: string;
  category: AssetCategory;
  value: number;
  weight: number;
  quantity: number;
}

export interface AllocationDatum {
  name: string;
  value: number;
  color: string;
}

export interface CategoryPerformanceDatum {
  category: string;
  cost: number;
  value: number;
}

export interface Cs2TypeBreakdownDatum {
  type: string;
  value: number;
  count: number;
}

export interface TelegramCollectionBreakdownDatum {
  collection: string;
  value: number;
  quantity: number;
  positions: number;
}

export interface SummaryCardDatum {
  id: string;
  label: string;
  value: number | string;
  hint: string;
  format?: "currency" | "percent" | "compact" | "text";
  tone?: "neutral" | "positive" | "negative";
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalFees: number;
  totalRoi: number | null;
  positionsCount: number;
  itemsCount: number;
  breakdown: CategoryBreakdown[];
  topHoldings: TopHolding[];
  cards: SummaryCardDatum[];
  lastUpdatedAt: string;
  sourceMode: DataSourceMode;
  sourceLabel: string;
  warnings: string[];
  availableSheets: string[];
}

export interface Cs2Position {
  id: string;
  name: string;
  type: Cs2AssetType;
  category: string | null;
  quantity: number;
  quantitySource: QuantitySource;
  averageEntryPrice: number | null;
  manualCurrentPrice: number | null;
  currentPrice: number | null;
  totalValue: number;
  totalCost: number;
  pnl: number;
  pnlPercent: number | null;
  realizedPnl: number;
  unrealizedPnl: number;
  fees: number;
  transactionCount: number;
  riskScore: number;
  liquidityLabel: "High" | "Medium" | "Low" | "Unknown";
  priceSource: string;
  priceConfidence: Cs2PriceConfidence;
  priceLastUpdated: string | null;
  priceWarning: string | null;
  market: string | null;
  status: string | null;
  lastUpdated: string | null;
  notes: string | null;
  rowRef: SheetRowRef | null;
  isPriceEstimated: boolean;
}

export interface TelegramGiftPosition {
  id: string;
  name: string;
  collection: string | null;
  quantity: number;
  quantitySource: QuantitySource;
  entryPrice: number | null;
  averageEntryPrice: number | null;
  manualCurrentPrice: number | null;
  currentPrice: number | null;
  estimatedPrice: number | null;
  totalValue: number;
  totalCost: number;
  pnl: number;
  pnlPercent: number | null;
  realizedPnl: number;
  unrealizedPnl: number;
  fees: number;
  transactionCount: number;
  priceConfidence: TelegramPriceConfidence | null;
  priceSourceNote: string | null;
  priceLastCheckedAt: string | null;
  priceWarning: string | null;
  isPriceStale: boolean;
  liquidityNote: string | null;
  status: string | null;
  lastUpdated: string | null;
  notes: string | null;
  priceSource: string;
  rowRef: SheetRowRef | null;
}

export interface CryptoPosition {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  quantitySource: QuantitySource;
  averageEntryPrice: number | null;
  manualCurrentPrice: number | null;
  currentPrice: number | null;
  totalValue: number;
  totalCost: number;
  pnl: number;
  pnlPercent: number | null;
  realizedPnl: number;
  unrealizedPnl: number;
  fees: number;
  transactionCount: number;
  walletNote: string | null;
  status: string | null;
  lastUpdated: string | null;
  notes: string | null;
  priceSource: string;
  isLivePrice: boolean;
  rowRef: SheetRowRef | null;
}

export interface TransactionRecord {
  id: string;
  date: string | null;
  assetType: AssetCategory | null;
  assetName: string | null;
  action: TransactionAction | string;
  quantity: number | null;
  price: number | null;
  fees: number;
  currency: string | null;
  notes: string | null;
  rowRef: SheetRowRef | null;
}

export interface TelegramGiftAnalytics {
  totalValue: number;
  totalItems: number;
  valueByCollection: TelegramCollectionBreakdownDatum[];
  topGiftsByValue: TelegramGiftPosition[];
  lowConfidencePricing: TelegramGiftPosition[];
  stalePriceList: TelegramGiftPosition[];
  recentPriceUpdates: TransactionRecord[];
}

export interface PortfolioCharts {
  allocation: AllocationDatum[];
  categoryPerformance: CategoryPerformanceDatum[];
  cs2ByType: Cs2TypeBreakdownDatum[];
}

export interface PortfolioSnapshot {
  summary: PortfolioSummary;
  cs2: {
    positions: Cs2Position[];
    topPositions: Cs2Position[];
    riskPositions: Cs2Position[];
  };
  telegramGifts: {
    positions: TelegramGiftPosition[];
    analytics: TelegramGiftAnalytics;
  };
  crypto: {
    positions: CryptoPosition[];
  };
  transactions: {
    items: TransactionRecord[];
  };
  charts: PortfolioCharts;
  settings: Record<string, string>;
}
