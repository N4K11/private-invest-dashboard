import { CATEGORY_META, CS2_TYPE_RISK_WEIGHT } from "@/lib/constants";
import { clamp } from "@/lib/utils";
import type {
  AssetCategory,
  CategoryBreakdown,
  CryptoPosition,
  Cs2AssetType,
  Cs2Position,
  TelegramGiftPosition,
  TopHolding,
} from "@/types/portfolio";

export function computeMoneyMetrics(
  quantity: number,
  entryPrice: number | null,
  currentPrice: number | null,
) {
  const safeEntryPrice = entryPrice ?? 0;
  const safeCurrentPrice = currentPrice ?? entryPrice ?? 0;
  const totalCost = quantity * safeEntryPrice;
  const totalValue = quantity * safeCurrentPrice;
  const pnl = totalValue - totalCost;

  return {
    totalCost,
    totalValue,
    pnl,
    pnlPercent: totalCost > 0 ? (pnl / totalCost) * 100 : null,
  };
}

export function buildCategoryBreakdown(params: {
  cs2Positions: Cs2Position[];
  telegramPositions: TelegramGiftPosition[];
  cryptoPositions: CryptoPosition[];
}): CategoryBreakdown[] {
  const categories: {
    category: AssetCategory;
    positions: number;
    items: number;
    cost: number;
    value: number;
    realizedPnl: number;
    unrealizedPnl: number;
    fees: number;
  }[] = [
    {
      category: "cs2",
      positions: params.cs2Positions.length,
      items: params.cs2Positions.reduce((sum, item) => sum + item.quantity, 0),
      cost: params.cs2Positions.reduce((sum, item) => sum + item.totalCost, 0),
      value: params.cs2Positions.reduce((sum, item) => sum + item.totalValue, 0),
      realizedPnl: params.cs2Positions.reduce((sum, item) => sum + item.realizedPnl, 0),
      unrealizedPnl: params.cs2Positions.reduce((sum, item) => sum + item.unrealizedPnl, 0),
      fees: params.cs2Positions.reduce((sum, item) => sum + item.fees, 0),
    },
    {
      category: "telegram",
      positions: params.telegramPositions.length,
      items: params.telegramPositions.reduce((sum, item) => sum + item.quantity, 0),
      cost: params.telegramPositions.reduce((sum, item) => sum + item.totalCost, 0),
      value: params.telegramPositions.reduce((sum, item) => sum + item.totalValue, 0),
      realizedPnl: params.telegramPositions.reduce((sum, item) => sum + item.realizedPnl, 0),
      unrealizedPnl: params.telegramPositions.reduce((sum, item) => sum + item.unrealizedPnl, 0),
      fees: params.telegramPositions.reduce((sum, item) => sum + item.fees, 0),
    },
    {
      category: "crypto",
      positions: params.cryptoPositions.length,
      items: params.cryptoPositions.reduce((sum, item) => sum + item.quantity, 0),
      cost: params.cryptoPositions.reduce((sum, item) => sum + item.totalCost, 0),
      value: params.cryptoPositions.reduce((sum, item) => sum + item.totalValue, 0),
      realizedPnl: params.cryptoPositions.reduce((sum, item) => sum + item.realizedPnl, 0),
      unrealizedPnl: params.cryptoPositions.reduce((sum, item) => sum + item.unrealizedPnl, 0),
      fees: params.cryptoPositions.reduce((sum, item) => sum + item.fees, 0),
    },
  ];

  return categories.map((item) => {
    const pnl = item.realizedPnl + item.unrealizedPnl;
    return {
      category: item.category,
      label: CATEGORY_META[item.category].label,
      color: CATEGORY_META[item.category].color,
      value: item.value,
      cost: item.cost,
      pnl,
      realizedPnl: item.realizedPnl,
      unrealizedPnl: item.unrealizedPnl,
      fees: item.fees,
      roi: item.cost > 0 ? (pnl / item.cost) * 100 : null,
      positions: item.positions,
      items: item.items,
    };
  });
}

export function buildTopHoldings(params: {
  cs2Positions: Cs2Position[];
  telegramPositions: TelegramGiftPosition[];
  cryptoPositions: CryptoPosition[];
  totalValue: number;
}): TopHolding[] {
  const holdings: TopHolding[] = [
    ...params.cs2Positions.map((position) => ({
      id: position.id,
      name: position.name,
      category: "cs2" as const,
      value: position.totalValue,
      weight:
        params.totalValue > 0 ? (position.totalValue / params.totalValue) * 100 : 0,
      quantity: position.quantity,
    })),
    ...params.telegramPositions.map((position) => ({
      id: position.id,
      name: position.name,
      category: "telegram" as const,
      value: position.totalValue,
      weight:
        params.totalValue > 0 ? (position.totalValue / params.totalValue) * 100 : 0,
      quantity: position.quantity,
    })),
    ...params.cryptoPositions.map((position) => ({
      id: position.id,
      name: position.name,
      category: "crypto" as const,
      value: position.totalValue,
      weight:
        params.totalValue > 0 ? (position.totalValue / params.totalValue) * 100 : 0,
      quantity: position.quantity,
    })),
  ];

  return holdings.sort((left, right) => right.value - left.value).slice(0, 10);
}

export function deriveCs2RiskScore(params: {
  type: Cs2AssetType;
  totalValue: number;
  currentPrice: number | null;
  quantity: number;
  notes: string | null;
  concentrationShare: number;
  manualRiskScore: number | null;
}) {
  if (params.manualRiskScore !== null) {
    return clamp(params.manualRiskScore, 0, 100);
  }

  let score = CS2_TYPE_RISK_WEIGHT[params.type];

  if (params.currentPrice === null) {
    score += 28;
  }

  if (params.quantity <= 2) {
    score += 8;
  }

  if (params.concentrationShare >= 0.18) {
    score += 24;
  } else if (params.concentrationShare >= 0.1) {
    score += 16;
  } else if (params.concentrationShare >= 0.05) {
    score += 8;
  }

  if (params.totalValue >= 2500) {
    score += 6;
  }

  const noteText = params.notes?.toLowerCase() ?? "";
  if (noteText.includes("illiquid") || noteText.includes("neliquid")) {
    score += 12;
  }

  return clamp(score, 8, 96);
}

export function riskScoreToLiquidityLabel(score: number) {
  if (score >= 70) {
    return "Low" as const;
  }

  if (score >= 40) {
    return "Medium" as const;
  }

  return "High" as const;
}
