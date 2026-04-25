import {
  computeMoneyMetrics,
  deriveCs2RiskScore,
  riskScoreToLiquidityLabel,
} from "@/lib/portfolio/metrics";
import { getConfiguredCs2Providers } from "@/lib/providers/cs2/provider-registry";
import type { Cs2ResolvedPriceQuote } from "@/lib/providers/cs2/types";
import { isTimestampStale } from "@/lib/providers/cs2/utils";
import type { NormalizedCs2Row } from "@/lib/sheets/normalizers";
import type { Cs2Position } from "@/types/portfolio";

function normalizeLiquidityLabel(
  value: string | null,
  fallback: Cs2Position["liquidityLabel"],
): Cs2Position["liquidityLabel"] {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "high" || normalized === "высокая") {
    return "High";
  }

  if (normalized === "medium" || normalized === "средняя") {
    return "Medium";
  }

  if (normalized === "low" || normalized === "низкая") {
    return "Low";
  }

  return fallback;
}

function mapQuoteSourceToPriceSource(quote: Cs2ResolvedPriceQuote | null, row: NormalizedCs2Row) {
  if (!quote) {
    return row.currentPrice !== null ? row.sheetPriceSource ?? "manual_sheet" : "missing";
  }

  if (quote.sourceId === "steam") {
    return "steam_market_live";
  }

  if (quote.sourceId === "buff_proxy") {
    return "buff_proxy_live";
  }

  if (quote.sourceId === "csfloat") {
    return "csfloat_live";
  }

  if (quote.sourceId === "pricempire") {
    return "pricempire_live";
  }

  return row.sheetPriceSource ?? "manual_sheet";
}

function buildPriceWarning(quote: Cs2ResolvedPriceQuote | null, row: NormalizedCs2Row) {
  if (!quote) {
    return "Live provider не нашел цену, а в таблице нет manualCurrentPrice.";
  }

  if (quote.warning) {
    return quote.warning;
  }

  if (!quote.isLive && isTimestampStale(quote.lastUpdated ?? row.lastUpdated ?? null)) {
    return "Цена устарела и требует ручного обновления в Google Sheets.";
  }

  return null;
}

export async function resolveCs2Positions(rows: NormalizedCs2Row[]) {
  const { providers, warnings: registryWarnings } = getConfiguredCs2Providers();
  const lookups = rows.map((row) => ({
    assetId: row.id,
    assetName: row.name,
    row,
  }));
  const resolvedQuotes = new Map<string, Cs2ResolvedPriceQuote>();
  const warnings = [...registryWarnings];
  let unresolvedLookups = lookups;

  if (providers.length > 0) {
    warnings.push(
      `Активная цепочка CS2 providers: ${providers.map((provider) => provider.sourceName).join(" -> ")}.`,
    );
  }

  for (const provider of providers) {
    if (unresolvedLookups.length === 0) {
      break;
    }

    const result = await provider.getBulkPrices(unresolvedLookups);
    warnings.push(...result.warnings);

    for (const lookup of unresolvedLookups) {
      const quote = result.quotes.get(lookup.assetId);
      if (quote && quote.price !== null) {
        resolvedQuotes.set(lookup.assetId, quote);
      }
    }

    unresolvedLookups = unresolvedLookups.filter((lookup) => !resolvedQuotes.has(lookup.assetId));
  }

  const provisional = rows.map((row) => {
    const resolvedQuote = resolvedQuotes.get(row.id) ?? null;
    const resolvedCurrentPrice =
      resolvedQuote?.price ?? row.manualCurrentPrice ?? row.currentPrice ?? null;
    const metrics = computeMoneyMetrics(
      row.quantity,
      row.averageEntryPrice,
      resolvedCurrentPrice,
    );

    return {
      row,
      resolvedQuote,
      currentPrice: resolvedCurrentPrice,
      totalValue: metrics.totalValue,
      totalCost: metrics.totalCost,
      pnl: metrics.pnl,
      pnlPercent: metrics.pnlPercent,
    };
  });

  const totalCs2Value = provisional.reduce((sum, item) => sum + item.totalValue, 0);
  const positions: Cs2Position[] = provisional.map((item) => {
    const concentrationShare = totalCs2Value > 0 ? item.totalValue / totalCs2Value : 0;
    const riskScore = deriveCs2RiskScore({
      type: item.row.type,
      totalValue: item.totalValue,
      currentPrice: item.currentPrice,
      quantity: item.row.quantity,
      notes: item.row.notes,
      concentrationShare,
      manualRiskScore: item.row.manualRiskScore,
    });
    const fallbackLiquidity = riskScoreToLiquidityLabel(riskScore);
    const priceWarning = buildPriceWarning(item.resolvedQuote, item.row);
    const priceLastUpdated = item.resolvedQuote?.lastUpdated ?? item.row.lastUpdated ?? null;

    return {
      id: item.row.id,
      name: item.row.name,
      type: item.row.type,
      category: item.row.category ?? null,
      quantity: item.row.quantity,
      quantitySource: "sheet",
      averageEntryPrice: item.row.averageEntryPrice,
      manualCurrentPrice: item.row.manualCurrentPrice ?? item.row.currentPrice,
      currentPrice: item.currentPrice,
      totalValue: item.totalValue,
      totalCost: item.totalCost,
      pnl: item.pnl,
      pnlPercent: item.pnlPercent,
      realizedPnl: 0,
      unrealizedPnl: item.pnl,
      fees: 0,
      transactionCount: 0,
      riskScore,
      liquidityLabel: normalizeLiquidityLabel(item.row.liquidityLabel, fallbackLiquidity),
      priceSource: mapQuoteSourceToPriceSource(item.resolvedQuote, item.row),
      priceConfidence: item.resolvedQuote?.confidence ?? (priceWarning ? "low" : "medium"),
      priceLastUpdated,
      priceWarning,
      market: item.resolvedQuote?.sourceName ?? item.row.market,
      status: item.row.status ?? null,
      lastUpdated: item.row.lastUpdated ?? null,
      notes: item.row.notes,
      rowRef: item.row.sheetRef,
      isPriceEstimated: item.currentPrice === null,
    };
  });

  const staleCount = positions.filter(
    (position) => position.priceSource !== "steam_market_live" && Boolean(position.priceWarning),
  ).length;
  const liveCount = positions.filter((position) => position.priceSource.endsWith("_live")).length;
  const manualCount = positions.filter((position) => position.priceSource === "manual_sheet").length;
  const missingCount = positions.filter((position) => position.priceSource === "missing").length;

  if (liveCount > 0) {
    warnings.push(`CS2 live providers закрыли ${liveCount} позиций.`);
  }

  if (manualCount > 0) {
    warnings.push(`Для ${manualCount} CS2-позиций используется manual fallback из таблицы.`);
  }

  if (staleCount > 0) {
    warnings.push(`У ${staleCount} CS2-позиций цена устарела и требует обновления.`);
  }

  if (missingCount > 0) {
    warnings.push(`У ${missingCount} CS2-позиций цена отсутствует даже после всех fallback providers.`);
  }

  return {
    positions,
    warnings,
  };
}
