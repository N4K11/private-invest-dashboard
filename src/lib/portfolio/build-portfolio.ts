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
  CategoryPerformanceDatum,
  CryptoPosition,
  Cs2Position,
  Cs2TypeBreakdownDatum,
  PortfolioSnapshot,
  SummaryCardDatum,
  TelegramGiftPosition,
} from "@/types/portfolio";

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

function applyAccountingToCs2(
  positions: Cs2Position[],
  transactions: import("@/lib/sheets/normalizers").NormalizedTransactionRow[],
) {
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
      (position.currentPrice === null || position.priceSource === "manual_sheet" || position.priceSource === "missing");
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
  transactions: import("@/lib/sheets/normalizers").NormalizedTransactionRow[],
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
      ((position.estimatedPrice ?? position.currentPrice) === null ||
        position.priceSource === "manual_sheet");
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
    } satisfies TelegramGiftPosition;
  });

  return {
    positions: nextPositions,
    investedCapital: totalInvestedCapital,
  };
}

function applyAccountingToCrypto(
  positions: CryptoPosition[],
  transactions: import("@/lib/sheets/normalizers").NormalizedTransactionRow[],
) {
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

export async function getPortfolioSnapshot(): Promise<PortfolioSnapshot> {
  const source = await getPortfolioSource();
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
    },
    settings: {
      currency:
        source.workbook.settings.currency?.toUpperCase() ?? DEFAULT_CURRENCY,
      ...source.workbook.settings,
    },
  };
}


