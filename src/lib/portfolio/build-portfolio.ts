import { DEFAULT_CURRENCY } from "@/lib/constants";
import { buildCategoryBreakdown, buildTopHoldings } from "@/lib/portfolio/metrics";
import { resolveCryptoPositions } from "@/lib/providers/crypto-price-provider";
import { resolveCs2Positions } from "@/lib/providers/cs2-price-provider";
import { resolveTelegramGiftPositions } from "@/lib/providers/telegram-gift-price-provider";
import { getPortfolioSource } from "@/lib/sheets/reader";
import type {
  CategoryPerformanceDatum,
  Cs2TypeBreakdownDatum,
  PortfolioSnapshot,
  SummaryCardDatum,
} from "@/types/portfolio";

function buildSummaryCards(params: {
  totalValue: number;
  totalPnl: number;
  totalRoi: number | null;
  positionsCount: number;
  itemsCount: number;
}): SummaryCardDatum[] {
  return [
    {
      id: "total-value",
      label: "Total value",
      value: params.totalValue,
      hint: "Marked-to-market across CS2, gifts and crypto",
      tone: "neutral",
    },
    {
      id: "total-pnl",
      label: "Net PnL",
      value: params.totalPnl,
      hint: "Based on current prices vs average entry",
      tone: params.totalPnl >= 0 ? "positive" : "negative",
    },
    {
      id: "net-roi",
      label: "Net ROI",
      value: params.totalRoi ?? "—",
      hint: "Aggregated only where cost basis exists",
      tone:
        params.totalRoi === null ? "neutral" : params.totalRoi >= 0 ? "positive" : "negative",
    },
    {
      id: "positions-count",
      label: "Tracked positions",
      value: params.positionsCount,
      hint: `${params.itemsCount.toLocaleString("en-US")} units/items across all categories`,
      tone: "neutral",
    },
  ];
}

function buildCs2TypeChartData(positions: PortfolioSnapshot["cs2"]["positions"]) {
  const grouped = positions.reduce<Record<string, Cs2TypeBreakdownDatum>>((acc, position) => {
    const current = acc[position.type] ?? {
      type: position.type,
      value: 0,
      count: 0,
    };

    current.value += position.totalValue;
    current.count += position.quantity;
    acc[position.type] = current;
    return acc;
  }, {});

  return Object.values(grouped).sort((left, right) => right.value - left.value);
}

function buildCategoryPerformanceData(
  breakdown: PortfolioSnapshot["summary"]["breakdown"],
): CategoryPerformanceDatum[] {
  return breakdown.map((item) => ({
    category: item.label,
    cost: item.cost,
    value: item.value,
  }));
}

export async function getPortfolioSnapshot(): Promise<PortfolioSnapshot> {
  const source = await getPortfolioSource();
  const [cs2Result, telegramResult, cryptoResult] = await Promise.all([
    resolveCs2Positions(source.workbook.cs2Rows),
    resolveTelegramGiftPositions(source.workbook.telegramRows),
    resolveCryptoPositions(source.workbook.cryptoRows),
  ]);

  const cs2Positions = cs2Result.positions.sort((left, right) => right.totalValue - left.totalValue);
  const telegramPositions = telegramResult.positions.sort(
    (left, right) => right.totalValue - left.totalValue,
  );
  const cryptoPositions = cryptoResult.positions.sort((left, right) => right.totalValue - left.totalValue);

  const breakdown = buildCategoryBreakdown({
    cs2Positions,
    telegramPositions,
    cryptoPositions,
  });

  const totalValue = breakdown.reduce((sum, item) => sum + item.value, 0);
  const totalCost = breakdown.reduce((sum, item) => sum + item.cost, 0);
  const totalPnl = totalValue - totalCost;
  const totalRoi = totalCost > 0 ? (totalPnl / totalCost) * 100 : null;
  const positionsCount =
    cs2Positions.length + telegramPositions.length + cryptoPositions.length;
  const itemsCount = breakdown.reduce((sum, item) => sum + item.items, 0);
  const topHoldings = buildTopHoldings({
    cs2Positions,
    telegramPositions,
    cryptoPositions,
    totalValue,
  });

  return {
    summary: {
      totalValue,
      totalCost,
      totalPnl,
      totalRoi,
      positionsCount,
      itemsCount,
      breakdown,
      topHoldings,
      cards: buildSummaryCards({
        totalValue,
        totalPnl,
        totalRoi,
        positionsCount,
        itemsCount,
      }),
      lastUpdatedAt: source.lastUpdatedAt,
      sourceMode: source.sourceMode,
      sourceLabel: source.sourceLabel,
      warnings: [
        ...source.warnings,
        ...cs2Result.warnings,
        ...telegramResult.warnings,
        ...cryptoResult.warnings,
      ],
      availableSheets: source.workbook.availableSheets,
    },
    cs2: {
      positions: cs2Positions,
      topPositions: cs2Positions.slice(0, 10),
      riskPositions: [...cs2Positions]
        .sort((left, right) => right.riskScore - left.riskScore)
        .slice(0, 10),
    },
    telegramGifts: {
      positions: telegramPositions,
    },
    crypto: {
      positions: cryptoPositions,
    },
    charts: {
      allocation: breakdown
        .filter((item) => item.value > 0)
        .map((item) => ({
          name: item.label,
          value: item.value,
          color: item.color,
        })),
      categoryPerformance: buildCategoryPerformanceData(breakdown),
      cs2ByType: buildCs2TypeChartData(cs2Positions),
    },
    settings: {
      currency:
        source.workbook.settings.currency?.toUpperCase() ?? DEFAULT_CURRENCY,
      ...source.workbook.settings,
    },
  };
}
