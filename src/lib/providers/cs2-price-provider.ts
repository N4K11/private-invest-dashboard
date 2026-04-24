import {
  computeMoneyMetrics,
  deriveCs2RiskScore,
  riskScoreToLiquidityLabel,
} from "@/lib/portfolio/metrics";
import type { NormalizedCs2Row } from "@/lib/sheets/normalizers";
import type { Cs2Position } from "@/types/portfolio";

function normalizeLiquidityLabel(
  value: string | null,
  fallback: Cs2Position["liquidityLabel"],
): Cs2Position["liquidityLabel"] {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "high") {
    return "High";
  }

  if (normalized === "medium") {
    return "Medium";
  }

  if (normalized === "low") {
    return "Low";
  }

  return fallback;
}

export async function resolveCs2Positions(rows: NormalizedCs2Row[]) {
  const provisional = rows.map((row) => {
    const metrics = computeMoneyMetrics(
      row.quantity,
      row.averageEntryPrice,
      row.currentPrice,
    );

    return {
      row,
      totalValue: metrics.totalValue,
      totalCost: metrics.totalCost,
      pnl: metrics.pnl,
      pnlPercent: metrics.pnlPercent,
    };
  });

  const totalCs2Value = provisional.reduce((sum, item) => sum + item.totalValue, 0);

  const positions: Cs2Position[] = provisional.map((item) => {
    const concentrationShare =
      totalCs2Value > 0 ? item.totalValue / totalCs2Value : 0;

    const riskScore = deriveCs2RiskScore({
      type: item.row.type,
      totalValue: item.totalValue,
      currentPrice: item.row.currentPrice,
      quantity: item.row.quantity,
      notes: item.row.notes,
      concentrationShare,
      manualRiskScore: item.row.manualRiskScore,
    });

    const fallbackLiquidity = riskScoreToLiquidityLabel(riskScore);

    return {
      id: item.row.id,
      name: item.row.name,
      type: item.row.type,
      quantity: item.row.quantity,
      averageEntryPrice: item.row.averageEntryPrice,
      currentPrice: item.row.currentPrice,
      totalValue: item.totalValue,
      totalCost: item.totalCost,
      pnl: item.pnl,
      pnlPercent: item.pnlPercent,
      riskScore,
      liquidityLabel: normalizeLiquidityLabel(
        item.row.liquidityLabel,
        fallbackLiquidity,
      ),
      priceSource: item.row.currentPrice !== null ? "manual_sheet" : "entry_price_fallback",
      market: item.row.market,
      notes: item.row.notes,
      isPriceEstimated: item.row.currentPrice === null,
    };
  });

  return {
    positions,
    warnings: positions.some((position) => position.isPriceEstimated)
      ? [
          "Some CS2 positions are using entry-price fallback because current market prices are not set in Google Sheets yet.",
        ]
      : [],
  };
}
