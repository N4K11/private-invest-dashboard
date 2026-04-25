import { DEFAULT_CURRENCY } from "@/lib/constants";
import { buildCategoryBreakdown, buildTopHoldings } from "@/lib/portfolio/metrics";
import {
  buildTransactionRecords,
  computeAssetAccounting,
} from "@/lib/portfolio/transaction-accounting";
import { resolveCryptoPositions } from "@/lib/providers/crypto-price-provider";
import { resolveCs2Positions } from "@/lib/providers/cs2-price-provider";
import { resolveTelegramGiftPositions } from "@/lib/providers/telegram-gift-price-provider";
import { getPortfolioSource } from "@/lib/sheets/reader";
import type {
  NormalizedPortfolioHistoryRow,
  NormalizedTransactionRow,
} from "@/lib/sheets/normalizers";
import type {
  CategoryPerformanceDatum,
  CryptoPosition,
  Cs2Position,
  Cs2TypeBreakdownDatum,
  DataSourceMode,
  PortfolioHistoryRecord,
  PortfolioSnapshot,
  SummaryCardDatum,
  TelegramCollectionBreakdownDatum,
  TelegramGiftAnalytics,
  TelegramGiftPosition,
  TransactionRecord,
} from "@/types/portfolio";

interface SnapshotBuildSource {
  workbook: Awaited<ReturnType<typeof getPortfolioSource>>["workbook"];
  sourceMode: DataSourceMode;
  sourceLabel: string;
  warnings: string[];
  lastUpdatedAt: string;
}

function buildSummaryCards(params: {
  totalValue: number;
  totalCost: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalRoi: number | null;
  positionsCount: number;
  itemsCount: number;
  totalFees: number;
}): SummaryCardDatum[] {
  return [
    {
      id: "total-value",
      label: "Текущая стоимость",
      value: params.totalValue,
      hint: "Суммарная оценка всех открытых позиций на текущий момент.",
      format: "currency",
      tone: "neutral",
    },
    {
      id: "total-cost",
      label: "Cost basis",
      value: params.totalCost,
      hint: "Себестоимость только открытых позиций после учета покупок, продаж и трансферов.",
      format: "currency",
      tone: "neutral",
    },
    {
      id: "realized-pnl",
      label: "Realized PnL",
      value: params.realizedPnl,
      hint: `Закрытая прибыль/убыток с учетом комиссий. Всего комиссий: ${params.totalFees.toFixed(2)}.`,
      format: "currency",
      tone: params.realizedPnl >= 0 ? "positive" : "negative",
    },
    {
      id: "unrealized-pnl",
      label: "Unrealized PnL",
      value: params.unrealizedPnl,
      hint: "Переоценка по текущим открытым позициям относительно их остаточной себестоимости.",
      format: "currency",
      tone: params.unrealizedPnl >= 0 ? "positive" : "negative",
    },
    {
      id: "total-roi",
      label: "Total ROI",
      value: params.totalRoi ?? "—",
      hint: "ROI по суммарному вложенному капиталу, включая transaction-driven cost basis.",
      format: "percent",
      tone:
        params.totalRoi === null ? "neutral" : params.totalRoi >= 0 ? "positive" : "negative",
    },
    {
      id: "positions-count",
      label: "Позиции",
      value: params.positionsCount,
      hint: `${params.itemsCount.toLocaleString("ru-RU")} единиц и предметов в портфеле`,
      format: "compact",
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

function normalizeHistoryDate(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const directMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (directMatch) {
    return directMatch[1];
  }

  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString().slice(0, 10);
}

function buildPortfolioHistoryRecords(rows: NormalizedPortfolioHistoryRow[]) {
  const deduped = new Map<string, PortfolioHistoryRecord>();

  for (const row of rows) {
    const dateKey = normalizeHistoryDate(row.date);
    if (!dateKey) {
      continue;
    }

    deduped.set(dateKey, {
      date: dateKey,
      totalValue: row.totalValue ?? 0,
      cs2Value: row.cs2Value ?? 0,
      telegramValue: row.telegramValue ?? 0,
      cryptoValue: row.cryptoValue ?? 0,
      totalPnl: row.totalPnl ?? 0,
      notes: row.notes ?? null,
      rowRef: row.sheetRef ?? null,
    });
  }

  return Array.from(deduped.values()).sort((left, right) => left.date.localeCompare(right.date));
}

function buildPortfolioValueHistoryData(history: PortfolioHistoryRecord[]) {
  return history.map((item) => ({
    date: item.date,
    totalValue: item.totalValue,
  }));
}

function buildAssetClassHistoryData(history: PortfolioHistoryRecord[]) {
  return history.map((item) => ({
    date: item.date,
    cs2Value: item.cs2Value,
    telegramValue: item.telegramValue,
    cryptoValue: item.cryptoValue,
  }));
}

function buildPortfolioPnlHistoryData(history: PortfolioHistoryRecord[]) {
  return history.map((item) => ({
    date: item.date,
    totalPnl: item.totalPnl,
  }));
}

function isDateAfter(left: string | null, right: string | null) {
  if (!left) {
    return false;
  }

  const leftTimestamp = Date.parse(left);
  if (!Number.isFinite(leftTimestamp)) {
    return false;
  }

  if (!right) {
    return true;
  }

  const rightTimestamp = Date.parse(right);
  if (!Number.isFinite(rightTimestamp)) {
    return true;
  }

  return leftTimestamp >= rightTimestamp;
}

function applyAccountingToCs2(positions: Cs2Position[], transactions: NormalizedTransactionRow[]) {
  let totalInvestedCapital = 0;

  const nextPositions = positions.map((position) => {
    const accounting = computeAssetAccounting({
      category: "cs2",
      assetNames: [position.name],
      sheetQuantity: position.quantity,
      fallbackEntryPrice: position.averageEntryPrice,
      currentPrice: position.currentPrice,
      transactions,
    });

    totalInvestedCapital += accounting.investedCapital;

    const useTransactionPrice =
      accounting.latestPriceUpdate !== null &&
      (position.currentPrice === null ||
        position.priceSource === "manual_sheet" ||
        position.priceSource === "missing");
    const currentPrice = useTransactionPrice ? accounting.latestPriceUpdate : accounting.currentPrice;

    return {
      ...position,
      quantity: accounting.quantity,
      quantitySource: accounting.quantitySource,
      averageEntryPrice: accounting.averageEntryPrice,
      currentPrice,
      totalValue: accounting.totalValue,
      totalCost: accounting.totalCost,
      pnl: accounting.pnl,
      pnlPercent: accounting.pnlPercent,
      realizedPnl: accounting.realizedPnl,
      unrealizedPnl: accounting.unrealizedPnl,
      fees: accounting.fees,
      transactionCount: accounting.transactionCount,
      priceSource: useTransactionPrice ? "transaction_price_update" : position.priceSource,
      priceLastUpdated: useTransactionPrice ? accounting.latestPriceUpdateAt : position.priceLastUpdated,
      priceConfidence: useTransactionPrice ? "medium" : position.priceConfidence,
      priceWarning: useTransactionPrice ? null : position.priceWarning,
      isPriceEstimated: currentPrice === null,
    } satisfies Cs2Position;
  });

  return {
    positions: nextPositions,
    investedCapital: totalInvestedCapital,
  };
}

function applyAccountingToTelegram(
  positions: TelegramGiftPosition[],
  transactions: NormalizedTransactionRow[],
) {
  let totalInvestedCapital = 0;

  const nextPositions = positions.map((position) => {
    const accounting = computeAssetAccounting({
      category: "telegram",
      assetNames: [position.name],
      sheetQuantity: position.quantity,
      fallbackEntryPrice: position.averageEntryPrice ?? position.entryPrice,
      currentPrice: position.estimatedPrice ?? position.currentPrice,
      transactions,
    });

    totalInvestedCapital += accounting.investedCapital;

    const useTransactionPrice =
      accounting.latestPriceUpdate !== null &&
      (position.estimatedPrice === null ||
        position.priceSource === "manual_sheet" ||
        position.priceSource.startsWith("ton_sheet") ||
        isDateAfter(accounting.latestPriceUpdateAt, position.priceLastCheckedAt));
    const estimatedPrice = useTransactionPrice ? accounting.latestPriceUpdate : accounting.currentPrice;

    return {
      ...position,
      quantity: accounting.quantity,
      quantitySource: accounting.quantitySource,
      entryPrice: accounting.averageEntryPrice,
      averageEntryPrice: accounting.averageEntryPrice,
      currentPrice: useTransactionPrice ? accounting.latestPriceUpdate : position.currentPrice,
      estimatedPrice,
      totalValue: accounting.totalValue,
      totalCost: accounting.totalCost,
      pnl: accounting.pnl,
      pnlPercent: accounting.pnlPercent,
      realizedPnl: accounting.realizedPnl,
      unrealizedPnl: accounting.unrealizedPnl,
      fees: accounting.fees,
      transactionCount: accounting.transactionCount,
      priceSource: useTransactionPrice ? "transaction_price_update" : position.priceSource,
      priceLastCheckedAt: useTransactionPrice ? accounting.latestPriceUpdateAt : position.priceLastCheckedAt,
      priceSourceNote: useTransactionPrice
        ? "Последнее manual обновление через Transactions / price_update."
        : position.priceSourceNote,
      priceConfidence: useTransactionPrice ? position.priceConfidence ?? "medium" : position.priceConfidence,
      priceWarning: useTransactionPrice ? null : position.priceWarning,
      isPriceStale: useTransactionPrice ? false : position.isPriceStale,
    } satisfies TelegramGiftPosition;
  });

  return {
    positions: nextPositions,
    investedCapital: totalInvestedCapital,
  };
}

function applyAccountingToCrypto(positions: CryptoPosition[], transactions: NormalizedTransactionRow[]) {
  let totalInvestedCapital = 0;

  const nextPositions = positions.map((position) => {
    const accounting = computeAssetAccounting({
      category: "crypto",
      assetNames: [position.symbol, position.name],
      sheetQuantity: position.quantity,
      fallbackEntryPrice: position.averageEntryPrice,
      currentPrice: position.currentPrice,
      transactions,
    });

    totalInvestedCapital += accounting.investedCapital;

    const useTransactionPrice =
      accounting.latestPriceUpdate !== null &&
      (!position.isLivePrice || position.priceSource === "entry_price_fallback");
    const currentPrice = useTransactionPrice ? accounting.latestPriceUpdate : accounting.currentPrice;

    return {
      ...position,
      quantity: accounting.quantity,
      quantitySource: accounting.quantitySource,
      averageEntryPrice: accounting.averageEntryPrice,
      currentPrice,
      totalValue: accounting.totalValue,
      totalCost: accounting.totalCost,
      pnl: accounting.pnl,
      pnlPercent: accounting.pnlPercent,
      realizedPnl: accounting.realizedPnl,
      unrealizedPnl: accounting.unrealizedPnl,
      fees: accounting.fees,
      transactionCount: accounting.transactionCount,
      priceSource: useTransactionPrice ? "transaction_price_update" : position.priceSource,
      isLivePrice: useTransactionPrice ? false : position.isLivePrice,
    } satisfies CryptoPosition;
  });

  return {
    positions: nextPositions,
    investedCapital: totalInvestedCapital,
  };
}

function buildTelegramCollectionBreakdown(positions: TelegramGiftPosition[]) {
  const grouped = positions.reduce<Record<string, TelegramCollectionBreakdownDatum>>((acc, position) => {
    const collection = position.collection?.trim() || "Без коллекции";
    const current = acc[collection] ?? {
      collection,
      value: 0,
      quantity: 0,
      positions: 0,
    };

    current.value += position.totalValue;
    current.quantity += position.quantity;
    current.positions += 1;
    acc[collection] = current;
    return acc;
  }, {});

  return Object.values(grouped).sort((left, right) => right.value - left.value);
}

function buildTelegramGiftAnalytics(
  positions: TelegramGiftPosition[],
  transactions: TransactionRecord[],
): TelegramGiftAnalytics {
  return {
    totalValue: positions.reduce((sum, position) => sum + position.totalValue, 0),
    totalItems: positions.reduce((sum, position) => sum + position.quantity, 0),
    valueByCollection: buildTelegramCollectionBreakdown(positions).slice(0, 8),
    topGiftsByValue: positions.slice(0, 8),
    lowConfidencePricing: positions
      .filter((position) => position.priceConfidence === "low" || position.priceConfidence === null)
      .sort((left, right) => right.totalValue - left.totalValue)
      .slice(0, 8),
    stalePriceList: positions
      .filter((position) => position.isPriceStale)
      .sort((left, right) => right.totalValue - left.totalValue)
      .slice(0, 8),
    recentPriceUpdates: transactions
      .filter((transaction) => transaction.assetType === "telegram" && transaction.action === "price_update")
      .slice(0, 8),
  };
}


export async function buildPortfolioSnapshotFromSource(
  source: SnapshotBuildSource,
): Promise<PortfolioSnapshot> {
  const [cs2Result, telegramResult, cryptoResult] = await Promise.all([
    resolveCs2Positions(source.workbook.cs2Rows),
    resolveTelegramGiftPositions(source.workbook.telegramRows),
    resolveCryptoPositions(source.workbook.cryptoRows),
  ]);
  const rawTransactions = source.workbook.transactionRows;
  const transactions = buildTransactionRecords(rawTransactions);

  const accountedCs2 = applyAccountingToCs2(cs2Result.positions, rawTransactions);
  const accountedTelegram = applyAccountingToTelegram(telegramResult.positions, rawTransactions);
  const accountedCrypto = applyAccountingToCrypto(cryptoResult.positions, rawTransactions);

  const cs2Positions = accountedCs2.positions.sort((left, right) => right.totalValue - left.totalValue);
  const telegramPositions = accountedTelegram.positions.sort(
    (left, right) => right.totalValue - left.totalValue,
  );
  const cryptoPositions = accountedCrypto.positions.sort((left, right) => right.totalValue - left.totalValue);

  const breakdown = buildCategoryBreakdown({
    cs2Positions,
    telegramPositions,
    cryptoPositions,
  });

  const totalValue = breakdown.reduce((sum, item) => sum + item.value, 0);
  const totalCost = breakdown.reduce((sum, item) => sum + item.cost, 0);
  const realizedPnl = breakdown.reduce((sum, item) => sum + item.realizedPnl, 0);
  const unrealizedPnl = breakdown.reduce((sum, item) => sum + item.unrealizedPnl, 0);
  const totalPnl = realizedPnl + unrealizedPnl;
  const totalFees = breakdown.reduce((sum, item) => sum + item.fees, 0);
  const totalInvestedCapital =
    accountedCs2.investedCapital + accountedTelegram.investedCapital + accountedCrypto.investedCapital;
  const totalRoi = totalInvestedCapital > 0 ? (totalPnl / totalInvestedCapital) * 100 : null;
  const positionsCount = cs2Positions.length + telegramPositions.length + cryptoPositions.length;
  const itemsCount = breakdown.reduce((sum, item) => sum + item.items, 0);
  const topHoldings = buildTopHoldings({
    cs2Positions,
    telegramPositions,
    cryptoPositions,
    totalValue,
  });
  const historyItems = buildPortfolioHistoryRecords(source.workbook.portfolioHistoryRows);

  return {
    summary: {
      totalValue,
      totalCost,
      totalPnl,
      realizedPnl,
      unrealizedPnl,
      totalFees,
      totalRoi,
      positionsCount,
      itemsCount,
      breakdown,
      topHoldings,
      cards: buildSummaryCards({
        totalValue,
        totalCost,
        realizedPnl,
        unrealizedPnl,
        totalRoi,
        positionsCount,
        itemsCount,
        totalFees,
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
    history: {
      items: historyItems,
      hasHistory: historyItems.length > 0,
      lastSnapshotDate: historyItems.at(-1)?.date ?? null,
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
      analytics: buildTelegramGiftAnalytics(telegramPositions, transactions),
    },
    crypto: {
      positions: cryptoPositions,
    },
    transactions: {
      items: transactions,
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
      portfolioValueHistory: buildPortfolioValueHistoryData(historyItems),
      assetClassHistory: buildAssetClassHistoryData(historyItems),
      portfolioPnlHistory: buildPortfolioPnlHistoryData(historyItems),
    },
    settings: {
      currency: source.workbook.settings.currency?.toUpperCase() ?? DEFAULT_CURRENCY,
      ...source.workbook.settings,
    },
  };
}

export async function getPortfolioSnapshot(): Promise<PortfolioSnapshot> {
  const source = await getPortfolioSource();
  return buildPortfolioSnapshotFromSource(source);
}


