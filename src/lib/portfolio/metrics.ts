import { CATEGORY_META, CS2_TYPE_RISK_WEIGHT, PORTFOLIO_HIGH_RISK_SCORE } from "@/lib/constants";
import { clamp } from "@/lib/utils";
import type {
  AssetCategory,
  CategoryBreakdown,
  CategoryExposureDatum,
  CryptoPosition,
  Cs2AssetType,
  Cs2Position,
  PortfolioRiskAnalytics,
  PortfolioRiskPosition,
  PositionRecommendation,
  TelegramGiftPosition,
  TopHolding,
} from "@/types/portfolio";

function hasKeyword(value: string | null | undefined, keywords: string[]) {
  const normalized = value?.toLowerCase() ?? "";
  return keywords.some((keyword) => normalized.includes(keyword));
}

function buildRiskSummary(factors: string[]) {
  if (factors.length === 0) {
    return "Явных красных флагов по позиции сейчас нет, риск выглядит контролируемым.";
  }

  if (factors.length === 1) {
    return factors[0];
  }

  return `${factors[0]} Также: ${factors.slice(1).join("; ")}.`;
}

function getConcentrationRisk(weight: number) {
  if (weight >= 25) {
    return {
      score: 30,
      factor: `Слишком большая концентрация: позиция занимает ${weight.toFixed(1)}% портфеля.`,
    };
  }

  if (weight >= 15) {
    return {
      score: 20,
      factor: `Концентрация повышена: позиция уже занимает ${weight.toFixed(1)}% портфеля.`,
    };
  }

  if (weight >= 8) {
    return {
      score: 10,
      factor: `Доля позиции заметна: ${weight.toFixed(1)}% портфеля в одном активе.`,
    };
  }

  return {
    score: 0,
    factor: null,
  };
}

function getRecommendation(params: {
  hasMissingPrice: boolean;
  hasStalePrice: boolean;
  hasLowLiquidity: boolean;
  weight: number;
  riskScore: number;
}): PositionRecommendation {
  if (params.hasMissingPrice || params.hasStalePrice) {
    return "needs_price_update";
  }

  if (params.hasLowLiquidity) {
    return "illiquid";
  }

  if (params.weight >= 18 || (params.weight >= 12 && params.riskScore >= 72)) {
    return "consider_trimming";
  }

  if (params.riskScore >= 42) {
    return "watch";
  }

  return "hold";
}

function buildRiskPosition(
  base: Omit<PortfolioRiskPosition, "riskSummary" | "riskFactors">,
  riskFactors: string[],
): PortfolioRiskPosition {
  return {
    ...base,
    riskFactors,
    riskSummary: buildRiskSummary(riskFactors),
  };
}

function annotateCs2Position(position: Cs2Position, totalPortfolioValue: number) {
  const weight = totalPortfolioValue > 0 ? (position.totalValue / totalPortfolioValue) * 100 : 0;
  let score = position.riskScore;
  const riskFactors: string[] = [];
  const hasMissingPrice = position.currentPrice === null;
  const hasStalePrice = Boolean(position.priceWarning && /устар|требует.*обновлен/i.test(position.priceWarning));
  const hasLowLiquidity = position.liquidityLabel === "Low";

  if (hasMissingPrice) {
    score += 32;
    riskFactors.push("По позиции нет актуальной цены, поэтому оценка портфеля по ней ненадежна.");
  }

  if (hasStalePrice) {
    score += 18;
    riskFactors.push("Цена устарела и требует ручного обновления.");
  }

  if (position.priceConfidence === "low") {
    score += 12;
    riskFactors.push("Уверенность в цене низкая, поэтому итоговая оценка может быть шумной.");
  } else if (position.priceConfidence === "medium" && !position.priceSource.endsWith("_live")) {
    score += 6;
    riskFactors.push("Цена не полностью live и частично зависит от manual/fallback-источника.");
  }

  if (position.liquidityLabel === "Low") {
    score += 22;
    riskFactors.push("Ликвидность низкая: быстро выйти из позиции по расчетной цене может быть сложно.");
  } else if (position.liquidityLabel === "Medium") {
    score += 10;
    riskFactors.push("Ликвидность средняя, при продаже возможен ощутимый спред.");
  }

  const concentration = getConcentrationRisk(weight);
  score += concentration.score;
  if (concentration.factor) {
    riskFactors.push(concentration.factor);
  }

  score = clamp(score, 8, 99);
  const recommendation = getRecommendation({
    hasMissingPrice,
    hasStalePrice,
    hasLowLiquidity,
    weight,
    riskScore: score,
  });

  const riskPosition = buildRiskPosition(
    {
      id: position.id,
      name: position.name,
      category: "cs2",
      quantity: position.quantity,
      value: position.totalValue,
      weight,
      riskScore: score,
      recommendation,
    },
    riskFactors,
  );

  return {
    position: {
      ...position,
      riskScore: score,
      portfolioWeight: weight,
      recommendation,
      riskSummary: riskPosition.riskSummary,
      riskFactors,
    } satisfies Cs2Position,
    riskPosition,
    flags: {
      hasMissingPrice,
      hasStalePrice,
      hasLowLiquidity,
    },
  };
}

function annotateTelegramPosition(position: TelegramGiftPosition, totalPortfolioValue: number) {
  const weight = totalPortfolioValue > 0 ? (position.totalValue / totalPortfolioValue) * 100 : 0;
  let score = 16;
  const riskFactors: string[] = [];
  const hasMissingPrice = position.estimatedPrice === null;
  const hasStalePrice = position.isPriceStale;
  const hasLowLiquidity = hasKeyword(position.liquidityNote, [
    "low",
    "низ",
    "тонк",
    "thin",
    "illiquid",
    "неликвид",
  ]);

  if (hasMissingPrice) {
    score += 34;
    riskFactors.push("По подарку нет актуальной оценки, поэтому его вклад в портфель пока не подтвержден ценой.");
  }

  if (hasStalePrice) {
    score += 20;
    riskFactors.push("Цена давно не проверялась и требует нового price check.");
  }

  if (position.priceConfidence === "low") {
    score += 20;
    riskFactors.push("Уверенность в цене низкая, поэтому manual-оценку лучше перепроверить.");
  } else if (position.priceConfidence === "medium") {
    score += 10;
    riskFactors.push("Уверенность в цене средняя, стоит периодически подтверждать котировку.");
  } else if (position.priceConfidence === null) {
    score += 16;
    riskFactors.push("Для позиции не задан confidence по цене, поэтому риск выше обычного manual режима.");
  }

  if (position.priceSource.startsWith("ton_sheet")) {
    score += 8;
    riskFactors.push("Оценка частично зависит от TON-конвертации, а не от прямого market price.");
  }

  if (hasLowLiquidity) {
    score += 18;
    riskFactors.push("Ликвидность отмечена как слабая или тонкая, выйти по расчетной цене может быть сложно.");
  }

  const concentration = getConcentrationRisk(weight);
  score += concentration.score;
  if (concentration.factor) {
    riskFactors.push(concentration.factor);
  }

  score = clamp(score, 10, 99);
  const recommendation = getRecommendation({
    hasMissingPrice,
    hasStalePrice,
    hasLowLiquidity,
    weight,
    riskScore: score,
  });

  const riskPosition = buildRiskPosition(
    {
      id: position.id,
      name: position.name,
      category: "telegram",
      quantity: position.quantity,
      value: position.totalValue,
      weight,
      riskScore: score,
      recommendation,
    },
    riskFactors,
  );

  return {
    position: {
      ...position,
      riskScore: score,
      portfolioWeight: weight,
      recommendation,
      riskSummary: riskPosition.riskSummary,
      riskFactors,
    } satisfies TelegramGiftPosition,
    riskPosition,
    flags: {
      hasMissingPrice,
      hasStalePrice,
      hasLowLiquidity,
    },
  };
}

function annotateCryptoPosition(position: CryptoPosition, totalPortfolioValue: number) {
  const weight = totalPortfolioValue > 0 ? (position.totalValue / totalPortfolioValue) * 100 : 0;
  let score = position.isLivePrice ? 10 : 18;
  const riskFactors: string[] = [];
  const hasMissingPrice = position.currentPrice === null;
  const hasStalePrice = !position.isLivePrice && position.priceSource !== "manual_sheet";
  const hasLowLiquidity = false;

  if (hasMissingPrice) {
    score += 30;
    riskFactors.push("По монете нет рабочей текущей цены, поэтому оценка держится на fallback или вообще отсутствует.");
  }

  if (!position.isLivePrice) {
    score += 12;
    riskFactors.push("Позиция сейчас оценивается не live-котировкой, а manual/fallback-источником.");
  }

  if (position.priceSource === "entry_price_fallback") {
    score += 10;
    riskFactors.push("Используется резерв по цене входа, а не текущий рынок, поэтому PnL может отличаться от реальности.");
  }

  const concentration = getConcentrationRisk(weight);
  score += concentration.score;
  if (concentration.factor) {
    riskFactors.push(concentration.factor);
  }

  score = clamp(score, 8, 95);
  const recommendation = getRecommendation({
    hasMissingPrice,
    hasStalePrice,
    hasLowLiquidity,
    weight,
    riskScore: score,
  });

  const riskPosition = buildRiskPosition(
    {
      id: position.id,
      name: position.name,
      category: "crypto",
      quantity: position.quantity,
      value: position.totalValue,
      weight,
      riskScore: score,
      recommendation,
    },
    riskFactors,
  );

  return {
    position: {
      ...position,
      riskScore: score,
      portfolioWeight: weight,
      recommendation,
      riskSummary: riskPosition.riskSummary,
      riskFactors,
    } satisfies CryptoPosition,
    riskPosition,
    flags: {
      hasMissingPrice,
      hasStalePrice,
      hasLowLiquidity,
    },
  };
}

function buildPortfolioRiskSummary(params: {
  topByValue: PortfolioRiskPosition[];
  missingPriceCount: number;
  stalePriceCount: number;
  illiquidCount: number;
}) {
  const parts: string[] = [];
  const topPosition = params.topByValue[0];

  if (topPosition && topPosition.weight >= 15) {
    parts.push(
      `Главная концентрация сейчас в позиции ${topPosition.name}: ${topPosition.weight.toFixed(1)}% от всего портфеля.`,
    );
  }

  if (params.missingPriceCount > 0) {
    parts.push(`${params.missingPriceCount} позиций остаются без подтвержденной цены.`);
  }

  if (params.stalePriceCount > 0) {
    parts.push(`${params.stalePriceCount} позиций требуют обновления оценки.`);
  }

  if (params.illiquidCount > 0) {
    parts.push(`${params.illiquidCount} позиций выглядят неликвидными или тонкими по рынку.`);
  }

  if (parts.length === 0) {
    return "Риск распределен умеренно: критичных красных флагов по концентрации, ценам и ликвидности сейчас не видно.";
  }

  return parts.join(" ");
}

export function isPositionHighRisk(riskScore: number, recommendation: PositionRecommendation) {
  return (
    riskScore >= PORTFOLIO_HIGH_RISK_SCORE ||
    recommendation === "needs_price_update" ||
    recommendation === "illiquid" ||
    recommendation === "consider_trimming"
  );
}

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

export function buildPortfolioRiskAnalytics(params: {
  cs2Positions: Cs2Position[];
  telegramPositions: TelegramGiftPosition[];
  cryptoPositions: CryptoPosition[];
  breakdown: CategoryBreakdown[];
  totalValue: number;
}): {
  cs2Positions: Cs2Position[];
  telegramPositions: TelegramGiftPosition[];
  cryptoPositions: CryptoPosition[];
  analytics: PortfolioRiskAnalytics;
} {
  const annotatedCs2 = params.cs2Positions.map((position) => annotateCs2Position(position, params.totalValue));
  const annotatedTelegram = params.telegramPositions.map((position) =>
    annotateTelegramPosition(position, params.totalValue),
  );
  const annotatedCrypto = params.cryptoPositions.map((position) =>
    annotateCryptoPosition(position, params.totalValue),
  );

  const riskPositions = [
    ...annotatedCs2.map((item) => item.riskPosition),
    ...annotatedTelegram.map((item) => item.riskPosition),
    ...annotatedCrypto.map((item) => item.riskPosition),
  ];

  const missingPriceCount = [...annotatedCs2, ...annotatedTelegram, ...annotatedCrypto].filter(
    (item) => item.flags.hasMissingPrice,
  ).length;
  const stalePriceCount = [...annotatedCs2, ...annotatedTelegram, ...annotatedCrypto].filter(
    (item) => item.flags.hasStalePrice,
  ).length;
  const illiquidCount = [...annotatedCs2, ...annotatedTelegram, ...annotatedCrypto].filter(
    (item) => item.flags.hasLowLiquidity,
  ).length;

  const topByValue = [...riskPositions].sort((left, right) => right.value - left.value).slice(0, 10);
  const topByQuantity = [...riskPositions]
    .sort((left, right) => right.quantity - left.quantity)
    .slice(0, 10);
  const highRiskPositions = [...riskPositions]
    .filter((position) => isPositionHighRisk(position.riskScore, position.recommendation))
    .sort((left, right) => right.riskScore - left.riskScore)
    .slice(0, 10);

  const weightedRiskScore =
    params.totalValue > 0
      ? riskPositions.reduce((sum, position) => sum + position.riskScore * position.value, 0) / params.totalValue
      : riskPositions.reduce((sum, position) => sum + position.riskScore, 0) /
        Math.max(riskPositions.length, 1);

  const categoryExposure: CategoryExposureDatum[] = params.breakdown.map((item) => ({
    category: item.category,
    label: item.label,
    value: item.value,
    weight: params.totalValue > 0 ? (item.value / params.totalValue) * 100 : 0,
    color: item.color,
  }));

  return {
    cs2Positions: annotatedCs2.map((item) => item.position),
    telegramPositions: annotatedTelegram.map((item) => item.position),
    cryptoPositions: annotatedCrypto.map((item) => item.position),
    analytics: {
      portfolioRiskScore: Math.round(clamp(weightedRiskScore, 0, 100)),
      portfolioRiskSummary: buildPortfolioRiskSummary({
        topByValue,
        missingPriceCount,
        stalePriceCount,
        illiquidCount,
      }),
      maxPositionWeight: topByValue[0]?.weight ?? 0,
      highRiskCount: highRiskPositions.length,
      missingPriceCount,
      stalePriceCount,
      illiquidCount,
      topByValue,
      topByQuantity,
      highRiskPositions,
      categoryExposure,
    },
  };
}
