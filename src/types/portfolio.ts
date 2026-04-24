export type AssetCategory = "cs2" | "telegram" | "crypto";

export type Cs2AssetType =
  | "stickers"
  | "skins"
  | "cases"
  | "charms"
  | "graffiti"
  | "other";

export type DataSourceMode = "live" | "fallback" | "demo";

export interface CategoryBreakdown {
  category: AssetCategory;
  label: string;
  value: number;
  cost: number;
  pnl: number;
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

export interface SummaryCardDatum {
  id: string;
  label: string;
  value: number | string;
  hint: string;
  tone?: "neutral" | "positive" | "negative";
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalPnl: number;
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
  quantity: number;
  averageEntryPrice: number | null;
  currentPrice: number | null;
  totalValue: number;
  totalCost: number;
  pnl: number;
  pnlPercent: number | null;
  riskScore: number;
  liquidityLabel: "High" | "Medium" | "Low" | "Unknown";
  priceSource: string;
  market: string | null;
  notes: string | null;
  isPriceEstimated: boolean;
}

export interface TelegramGiftPosition {
  id: string;
  name: string;
  quantity: number;
  estimatedPrice: number | null;
  totalValue: number;
  notes: string | null;
  priceSource: string;
}

export interface CryptoPosition {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  averageEntryPrice: number | null;
  currentPrice: number | null;
  totalValue: number;
  totalCost: number;
  pnl: number;
  pnlPercent: number | null;
  notes: string | null;
  priceSource: string;
  isLivePrice: boolean;
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
  };
  crypto: {
    positions: CryptoPosition[];
  };
  charts: PortfolioCharts;
  settings: Record<string, string>;
}
