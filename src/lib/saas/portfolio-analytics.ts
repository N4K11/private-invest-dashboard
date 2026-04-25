import "server-only";

import type { AssetCategory, Prisma, TransactionAction } from "@prisma/client";

import { decimalToNumber } from "@/lib/saas/utils";
import type { SummaryCardDatum } from "@/types/portfolio";
import type {
  SaasAssetCategory,
  SaasPortfolioAnalytics,
  SaasPortfolioAnalyticsPosition,
  SaasPortfolioPositionRow,
  SaasPriceConfidenceStatus,
} from "@/types/saas";

const QUANTITY_EPSILON = 0.0000001;

type AnalyticsTransaction = {
  assetId: string;
  action: TransactionAction;
  occurredAt: Date;
  quantity: Prisma.Decimal | null;
  unitPrice: Prisma.Decimal | null;
  fees: Prisma.Decimal | null;
};

type AnalyticsPriceSnapshot = {
  assetId: string;
  capturedAt: Date;
  price: Prisma.Decimal;
  asset: {
    category: AssetCategory;
  };
};

type AccountingState = {
  quantity: number;
  heldCost: number;
  realizedPnl: number;
  fees: number;
  investedCapital: number;
  latestPriceUpdate: number | null;
  latestPriceUpdateAt: string | null;
  inventoryTransactions: number;
};

type CurrentAccounting = {
  quantity: number;
  cost: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  fees: number;
  roi: number | null;
};

type HistoryAccumulator = {
  position: SaasPortfolioPositionRow;
  transactions: {
    timestamp: number;
    row: AnalyticsTransaction;
  }[];
  snapshots: {
    timestamp: number;
    price: number;
  }[];
  transactionIndex: number;
  snapshotIndex: number;
  state: AccountingState;
  lastKnownPrice: number | null;
  firstSnapshotPrice: number | null;
};

function clampNearZero(value: number) {
  return Math.abs(value) < QUANTITY_EPSILON ? 0 : value;
}

function getDateKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

function getEndOfDayTimestamp(dateKey: string) {
  return Date.parse(`${dateKey}T23:59:59.999Z`);
}

function buildInitialState(): AccountingState {
  return {
    quantity: 0,
    heldCost: 0,
    realizedPnl: 0,
    fees: 0,
    investedCapital: 0,
    latestPriceUpdate: null,
    latestPriceUpdateAt: null,
    inventoryTransactions: 0,
  };
}

function getPositionCurrentPrice(position: SaasPortfolioPositionRow) {
  return position.manualCurrentPrice ?? position.currentPrice ?? position.averageEntryPrice ?? null;
}

function getFallbackUnitCost(position: SaasPortfolioPositionRow) {
  return position.averageEntryPrice ?? getPositionCurrentPrice(position) ?? 0;
}

function removeInventory(params: {
  requestedQuantity: number;
  heldQuantity: number;
  heldCost: number;
  fallbackUnitCost: number;
}) {
  const availableQuantity = params.heldQuantity > QUANTITY_EPSILON ? params.heldQuantity : 0;
  const averageUnitCost =
    availableQuantity > QUANTITY_EPSILON ? params.heldCost / availableQuantity : params.fallbackUnitCost;
  const removableQuantity = Math.min(params.requestedQuantity, availableQuantity);
  const overflowQuantity = Math.max(0, params.requestedQuantity - removableQuantity);
  const costRemoved = removableQuantity * averageUnitCost + overflowQuantity * params.fallbackUnitCost;

  return {
    nextQuantity: clampNearZero(availableQuantity - removableQuantity),
    nextCost: clampNearZero(Math.max(0, params.heldCost - removableQuantity * averageUnitCost)),
    costRemoved,
  };
}

function applyTransactionToState(
  state: AccountingState,
  transaction: AnalyticsTransaction,
  fallbackUnitCost: number,
) {
  const price = decimalToNumber(transaction.unitPrice);
  const feeAmount = Math.max(0, decimalToNumber(transaction.fees) ?? 0);
  const numericQuantity = decimalToNumber(transaction.quantity) ?? 0;

  if (transaction.action === "BUY") {
    const quantity = Math.abs(numericQuantity);
    if (quantity <= 0) {
      return;
    }

    const unitCost = price ?? state.latestPriceUpdate ?? fallbackUnitCost;
    state.quantity += quantity;
    state.heldCost += quantity * unitCost + feeAmount;
    state.fees += feeAmount;
    state.investedCapital += quantity * unitCost + feeAmount;
    state.inventoryTransactions += 1;
    return;
  }

  if (transaction.action === "SELL") {
    const quantity = Math.abs(numericQuantity);
    if (quantity <= 0) {
      return;
    }

    const sellPrice = price ?? state.latestPriceUpdate ?? fallbackUnitCost;
    const removal = removeInventory({
      requestedQuantity: quantity,
      heldQuantity: state.quantity,
      heldCost: state.heldCost,
      fallbackUnitCost,
    });

    state.quantity = removal.nextQuantity;
    state.heldCost = removal.nextCost;
    state.realizedPnl += quantity * sellPrice - feeAmount - removal.costRemoved;
    state.fees += feeAmount;
    state.inventoryTransactions += 1;
    return;
  }

  if (transaction.action === "TRANSFER") {
    if (Math.abs(numericQuantity) <= QUANTITY_EPSILON) {
      return;
    }

    if (numericQuantity > 0) {
      const unitCost = price ?? state.latestPriceUpdate ?? fallbackUnitCost;
      state.quantity += numericQuantity;
      state.heldCost += numericQuantity * unitCost + feeAmount;
      state.investedCapital += numericQuantity * unitCost + feeAmount;
    } else {
      const removal = removeInventory({
        requestedQuantity: Math.abs(numericQuantity),
        heldQuantity: state.quantity,
        heldCost: state.heldCost,
        fallbackUnitCost,
      });

      state.quantity = removal.nextQuantity;
      state.heldCost = removal.nextCost;
    }

    state.fees += feeAmount;
    state.inventoryTransactions += 1;
    return;
  }

  if (transaction.action === "PRICE_UPDATE") {
    if (price !== null) {
      state.latestPriceUpdate = price;
      state.latestPriceUpdateAt = transaction.occurredAt.toISOString();
    }

    if (feeAmount > 0) {
      state.fees += feeAmount;
      state.realizedPnl -= feeAmount;
    }
    return;
  }

  if (transaction.action === "FEE") {
    const standaloneFee = feeAmount > 0 ? feeAmount : Math.max(0, price ?? 0);
    if (standaloneFee > 0) {
      state.fees += standaloneFee;
      state.realizedPnl -= standaloneFee;
    }
    return;
  }

  if (transaction.action === "ADJUSTMENT") {
    if (Math.abs(numericQuantity) <= QUANTITY_EPSILON) {
      return;
    }

    state.quantity = Math.max(0, numericQuantity);
    state.heldCost = state.quantity * (price ?? fallbackUnitCost);
    state.inventoryTransactions += 1;
  }
}

function buildCurrentAccounting(
  position: SaasPortfolioPositionRow,
  transactions: AnalyticsTransaction[],
): CurrentAccounting {
  if (transactions.length === 0) {
    const unrealizedPnl = position.totalValue - position.totalCost;

    return {
      quantity: position.quantity,
      cost: position.totalCost,
      realizedPnl: 0,
      unrealizedPnl,
      totalPnl: unrealizedPnl,
      fees: 0,
      roi: position.totalCost > 0 ? (unrealizedPnl / position.totalCost) * 100 : null,
    };
  }

  const state = buildInitialState();
  const fallbackUnitCost = getFallbackUnitCost(position);
  const sortedTransactions = [...transactions].sort(
    (left, right) => left.occurredAt.getTime() - right.occurredAt.getTime(),
  );

  for (const transaction of sortedTransactions) {
    applyTransactionToState(state, transaction, fallbackUnitCost);
  }

  let heldQuantity = state.inventoryTransactions > 0 ? state.quantity : position.quantity;
  let heldCost = state.inventoryTransactions > 0 ? state.heldCost : position.totalCost;
  const currentQuantity = position.quantity;

  if (state.inventoryTransactions > 0) {
    const quantityDiff = currentQuantity - heldQuantity;

    if (quantityDiff > QUANTITY_EPSILON) {
      const syntheticUnitCost =
        position.averageEntryPrice ??
        (heldQuantity > QUANTITY_EPSILON ? heldCost / heldQuantity : fallbackUnitCost);
      heldQuantity += quantityDiff;
      heldCost += quantityDiff * syntheticUnitCost;
      state.investedCapital += quantityDiff * syntheticUnitCost;
    } else if (quantityDiff < -QUANTITY_EPSILON) {
      const removal = removeInventory({
        requestedQuantity: Math.abs(quantityDiff),
        heldQuantity,
        heldCost,
        fallbackUnitCost,
      });
      heldQuantity = currentQuantity;
      heldCost = removal.nextCost;
    }
  }

  heldQuantity = clampNearZero(heldQuantity);
  heldCost = clampNearZero(heldCost);

  const unrealizedPnl = position.totalValue - heldCost;
  const totalPnl = state.realizedPnl + unrealizedPnl;
  const roiBase = state.investedCapital > QUANTITY_EPSILON ? state.investedCapital : heldCost;

  return {
    quantity: heldQuantity,
    cost: heldCost,
    realizedPnl: state.realizedPnl,
    unrealizedPnl,
    totalPnl,
    fees: state.fees,
    roi: roiBase > QUANTITY_EPSILON ? (totalPnl / roiBase) * 100 : null,
  };
}

function buildExplainability(position: {
  assetName: string;
  weight: number;
  totalPnl: number;
  priceConfidenceStatus: SaasPriceConfidenceStatus;
  liquidity: SaasPortfolioPositionRow["liquidity"];
}) {
  const explainability: string[] = [];
  const riskFlags = new Set<SaasPortfolioAnalyticsPosition["riskFlags"][number]>();

  if (position.weight >= 18) {
    riskFlags.add("concentration");
    explainability.push(
      `Позиция занимает ${position.weight.toFixed(1)}% портфеля и уже создает заметный риск концентрации.`,
    );
  } else if (position.weight >= 10) {
    riskFlags.add("concentration");
    explainability.push(
      `Доля ${position.weight.toFixed(1)}% делает позицию одной из крупнейших в портфеле.`,
    );
  }

  if (position.priceConfidenceStatus === "unknown") {
    riskFlags.add("missing_price");
    explainability.push("Для позиции нет подтвержденной рабочей цены, поэтому оценка остается неполной.");
  } else if (position.priceConfidenceStatus === "stale") {
    riskFlags.add("stale_price");
    explainability.push("Текущая цена устарела и требует нового review или свежего snapshot.");
  } else if (position.priceConfidenceStatus === "manual_low") {
    riskFlags.add("low_confidence");
    explainability.push("Оценка держится на low-confidence manual quote, ее лучше перепроверить.");
  }

  if (position.liquidity === "low") {
    riskFlags.add("low_liquidity");
    explainability.push("Ликвидность позиции отмечена как low, поэтому выход может быть сложнее расчетной оценки.");
  }

  if (position.totalPnl < 0) {
    riskFlags.add("negative_pnl");
    explainability.push("Позиция сейчас в отрицательном PnL и тянет общую доходность вниз.");
  }

  return {
    riskFlags: [...riskFlags],
    explainability,
  };
}

function buildConcentrationSummary(maxPositionWeight: number, topThreeWeight: number) {
  if (maxPositionWeight >= 25 || topThreeWeight >= 65) {
    return "Концентрация высокая: одна или несколько крупнейших позиций формируют большую часть портфеля. Любое движение по ним заметно влияет на общий результат.";
  }

  if (maxPositionWeight >= 15 || topThreeWeight >= 50) {
    return "Концентрация умеренно повышена: топ-позиции уже задают тон PnL и требуют отдельного контроля веса.";
  }

  return "Концентрация выглядит контролируемой: капитал распределен относительно ровно между позициями.";
}

function getHistoryCategoryBucket(category: SaasAssetCategory) {
  if (category === "cs2" || category === "telegram" || category === "crypto") {
    return category;
  }

  return "other" as const;
}

function buildCurrentPoint(options: {
  date: string;
  positions: SaasPortfolioPositionRow[];
  currentAccounting: Map<string, CurrentAccounting>;
}) {
  let totalValue = 0;
  let totalPnl = 0;
  let cs2Value = 0;
  let telegramValue = 0;
  let cryptoValue = 0;
  let otherValue = 0;

  for (const position of options.positions) {
    const accounting = options.currentAccounting.get(position.assetId);
    totalValue += position.totalValue;
    totalPnl += accounting?.totalPnl ?? position.pnl;

    const bucket = getHistoryCategoryBucket(position.category);
    if (bucket === "cs2") {
      cs2Value += position.totalValue;
    } else if (bucket === "telegram") {
      telegramValue += position.totalValue;
    } else if (bucket === "crypto") {
      cryptoValue += position.totalValue;
    } else {
      otherValue += position.totalValue;
    }
  }

  return {
    date: options.date,
    totalValue,
    totalPnl,
    cs2Value,
    telegramValue,
    cryptoValue,
    otherValue,
  };
}

function buildHistorySeries(options: {
  positions: SaasPortfolioPositionRow[];
  transactions: AnalyticsTransaction[];
  snapshots: AnalyticsPriceSnapshot[];
  currentAccounting: Map<string, CurrentAccounting>;
}) {
  const transactionsByAssetId = new Map<string, AnalyticsTransaction[]>();
  const snapshotsByAssetId = new Map<string, { timestamp: number; price: number }[]>();
  const historyDateKeys = new Set<string>();
  const warnings: string[] = [];

  for (const transaction of options.transactions) {
    const list = transactionsByAssetId.get(transaction.assetId) ?? [];
    list.push(transaction);
    transactionsByAssetId.set(transaction.assetId, list);
    historyDateKeys.add(getDateKey(transaction.occurredAt));
  }

  for (const snapshot of options.snapshots) {
    const price = decimalToNumber(snapshot.price);
    if (price === null) {
      continue;
    }

    const list = snapshotsByAssetId.get(snapshot.assetId) ?? [];
    list.push({
      timestamp: snapshot.capturedAt.getTime(),
      price,
    });
    snapshotsByAssetId.set(snapshot.assetId, list);
    historyDateKeys.add(getDateKey(snapshot.capturedAt));
  }

  const accumulators: HistoryAccumulator[] = options.positions.map((position) => {
    const transactions = (transactionsByAssetId.get(position.assetId) ?? [])
      .map((row) => ({ timestamp: row.occurredAt.getTime(), row }))
      .sort((left, right) => left.timestamp - right.timestamp);
    const snapshots = (snapshotsByAssetId.get(position.assetId) ?? []).sort(
      (left, right) => left.timestamp - right.timestamp,
    );

    return {
      position,
      transactions,
      snapshots,
      transactionIndex: 0,
      snapshotIndex: 0,
      state: buildInitialState(),
      lastKnownPrice: null,
      firstSnapshotPrice: snapshots[0]?.price ?? null,
    };
  });

  const assetsWithoutSnapshots = accumulators.filter((entry) => entry.snapshots.length === 0).length;
  if (assetsWithoutSnapshots > 0) {
    warnings.push(
      `В исторических рядах для ${assetsWithoutSnapshots} активов используется fallback по текущим manual-ценам, потому что price snapshots еще не накоплены.`,
    );
  }

  const sortedDateKeys = [...historyDateKeys].sort();
  const totalValueHistory: SaasPortfolioAnalytics["totalValueHistory"] = [];
  const totalPnlHistory: SaasPortfolioAnalytics["totalPnlHistory"] = [];
  const assetClassHistory: SaasPortfolioAnalytics["assetClassHistory"] = [];

  for (const dateKey of sortedDateKeys) {
    const endOfDay = getEndOfDayTimestamp(dateKey);
    let totalValue = 0;
    let totalPnl = 0;
    let cs2Value = 0;
    let telegramValue = 0;
    let cryptoValue = 0;
    let otherValue = 0;

    for (const entry of accumulators) {
      const fallbackUnitCost = getFallbackUnitCost(entry.position);

      while (
        entry.transactionIndex < entry.transactions.length &&
        entry.transactions[entry.transactionIndex].timestamp <= endOfDay
      ) {
        applyTransactionToState(entry.state, entry.transactions[entry.transactionIndex].row, fallbackUnitCost);
        entry.transactionIndex += 1;
      }

      while (
        entry.snapshotIndex < entry.snapshots.length &&
        entry.snapshots[entry.snapshotIndex].timestamp <= endOfDay
      ) {
        entry.lastKnownPrice = entry.snapshots[entry.snapshotIndex].price;
        entry.snapshotIndex += 1;
      }

      const trackedInventory = entry.state.inventoryTransactions > 0;
      const quantity = trackedInventory ? entry.state.quantity : entry.position.quantity;
      const cost = trackedInventory ? entry.state.heldCost : entry.position.totalCost;
      const price = entry.lastKnownPrice ?? entry.firstSnapshotPrice ?? getPositionCurrentPrice(entry.position) ?? 0;
      const value = quantity * price;
      const pnl = (trackedInventory ? entry.state.realizedPnl : 0) + (value - cost);

      totalValue += value;
      totalPnl += pnl;

      const bucket = getHistoryCategoryBucket(entry.position.category);
      if (bucket === "cs2") {
        cs2Value += value;
      } else if (bucket === "telegram") {
        telegramValue += value;
      } else if (bucket === "crypto") {
        cryptoValue += value;
      } else {
        otherValue += value;
      }
    }

    totalValueHistory.push({
      date: dateKey,
      totalValue,
    });
    totalPnlHistory.push({
      date: dateKey,
      totalPnl,
    });
    assetClassHistory.push({
      date: dateKey,
      cs2Value,
      telegramValue,
      cryptoValue,
      otherValue,
    });
  }

  const currentDateKey = getDateKey(new Date());
  const currentPoint = buildCurrentPoint({
    date: currentDateKey,
    positions: options.positions,
    currentAccounting: options.currentAccounting,
  });

  if (totalValueHistory.length > 0 && totalValueHistory[totalValueHistory.length - 1]?.date === currentDateKey) {
    totalValueHistory[totalValueHistory.length - 1] = {
      date: currentDateKey,
      totalValue: currentPoint.totalValue,
    };
    totalPnlHistory[totalPnlHistory.length - 1] = {
      date: currentDateKey,
      totalPnl: currentPoint.totalPnl,
    };
    assetClassHistory[assetClassHistory.length - 1] = {
      date: currentDateKey,
      cs2Value: currentPoint.cs2Value,
      telegramValue: currentPoint.telegramValue,
      cryptoValue: currentPoint.cryptoValue,
      otherValue: currentPoint.otherValue,
    };
  } else {
    totalValueHistory.push({
      date: currentDateKey,
      totalValue: currentPoint.totalValue,
    });
    totalPnlHistory.push({
      date: currentDateKey,
      totalPnl: currentPoint.totalPnl,
    });
    assetClassHistory.push({
      date: currentDateKey,
      cs2Value: currentPoint.cs2Value,
      telegramValue: currentPoint.telegramValue,
      cryptoValue: currentPoint.cryptoValue,
      otherValue: currentPoint.otherValue,
    });
  }

  if (sortedDateKeys.length === 0) {
    warnings.push("Исторические графики пока стартуют с текущего состояния портфеля, потому что price snapshots еще не сохранены.");
  }

  return {
    totalValueHistory,
    totalPnlHistory,
    assetClassHistory,
    warnings,
  };
}

export function buildSaasPortfolioAnalytics(options: {
  baseCurrency: string;
  positions: SaasPortfolioPositionRow[];
  transactions: AnalyticsTransaction[];
  snapshots: AnalyticsPriceSnapshot[];
}): SaasPortfolioAnalytics {
  const transactionsByAssetId = new Map<string, AnalyticsTransaction[]>();
  for (const transaction of options.transactions) {
    const list = transactionsByAssetId.get(transaction.assetId) ?? [];
    list.push(transaction);
    transactionsByAssetId.set(transaction.assetId, list);
  }

  const currentAccounting = new Map<string, CurrentAccounting>();
  for (const position of options.positions) {
    currentAccounting.set(
      position.assetId,
      buildCurrentAccounting(position, transactionsByAssetId.get(position.assetId) ?? []),
    );
  }

  const currentPortfolioValue = options.positions.reduce((sum, item) => sum + item.totalValue, 0);

  const analyticsPositions: SaasPortfolioAnalyticsPosition[] = options.positions.map((position) => {
    const accounting = currentAccounting.get(position.assetId)!;
    const weight = currentPortfolioValue > 0 ? (position.totalValue / currentPortfolioValue) * 100 : 0;
    const explainability = buildExplainability({
      assetName: position.assetName,
      weight,
      totalPnl: accounting.totalPnl,
      priceConfidenceStatus: position.priceConfidenceStatus,
      liquidity: position.liquidity,
    });

    return {
      positionId: position.id,
      assetId: position.assetId,
      assetName: position.assetName,
      category: position.category,
      value: position.totalValue,
      weight,
      totalPnl: accounting.totalPnl,
      realizedPnl: accounting.realizedPnl,
      unrealizedPnl: accounting.unrealizedPnl,
      roi: accounting.roi,
      priceConfidenceStatus: position.priceConfidenceStatus,
      liquidity: position.liquidity,
      riskFlags: explainability.riskFlags,
      explainability: explainability.explainability,
    };
  });

  const totalRealizedPnl = analyticsPositions.reduce((sum, position) => sum + position.realizedPnl, 0);
  const totalUnrealizedPnl = analyticsPositions.reduce((sum, position) => sum + position.unrealizedPnl, 0);
  const totalCost = options.positions.reduce(
    (sum, position) => sum + (currentAccounting.get(position.assetId)?.cost ?? position.totalCost),
    0,
  );
  const totalRoi = totalCost > 0 ? ((totalRealizedPnl + totalUnrealizedPnl) / totalCost) * 100 : null;
  const topPositions = [...analyticsPositions].sort((left, right) => right.value - left.value).slice(0, 8);
  const topThreeWeight = topPositions.slice(0, 3).reduce((sum, position) => sum + position.weight, 0);
  const maxPositionWeight = topPositions[0]?.weight ?? 0;
  const stalePriceCount = options.positions.filter((position) => position.priceConfidenceStatus === "stale").length;
  const lowConfidenceValuationCount = options.positions.filter(
    (position) => position.priceConfidenceStatus === "manual_low" || position.priceConfidenceStatus === "unknown",
  ).length;
  const winPositions = analyticsPositions.filter((position) => position.totalPnl > 0).length;
  const lossPositions = analyticsPositions.filter((position) => position.totalPnl < 0).length;

  const riskWatchlist = [...analyticsPositions]
    .filter(
      (position) =>
        position.riskFlags.length > 0 ||
        position.weight >= 10 ||
        position.priceConfidenceStatus === "stale" ||
        position.priceConfidenceStatus === "unknown",
    )
    .sort((left, right) => {
      if (right.riskFlags.length !== left.riskFlags.length) {
        return right.riskFlags.length - left.riskFlags.length;
      }

      return right.weight - left.weight;
    })
    .slice(0, 8);

  const cards: SummaryCardDatum[] = [
    {
      id: "realized-pnl",
      label: "Реализованный PnL",
      value: totalRealizedPnl,
      hint: "Результат по уже закрытой части позиций на основе transaction ledger.",
      format: "currency",
      tone: totalRealizedPnl > 0 ? "positive" : totalRealizedPnl < 0 ? "negative" : "neutral",
    },
    {
      id: "unrealized-pnl",
      label: "Нереализованный PnL",
      value: totalUnrealizedPnl,
      hint: "Разница между текущей valuation и cost basis по открытым остаткам.",
      format: "currency",
      tone: totalUnrealizedPnl > 0 ? "positive" : totalUnrealizedPnl < 0 ? "negative" : "neutral",
    },
    {
      id: "wins",
      label: "Плюсовые позиции",
      value: winPositions,
      hint: "Количество позиций, которые сейчас в плюсе по совокупному PnL.",
      format: "compact",
      tone: "positive",
    },
    {
      id: "losses",
      label: "Минусовые позиции",
      value: lossPositions,
      hint: "Количество позиций, которые сейчас дают отрицательный совокупный PnL.",
      format: "compact",
      tone: lossPositions > 0 ? "negative" : "neutral",
    },
    {
      id: "stale-prices",
      label: "Устаревшие цены",
      value: stalePriceCount,
      hint: "Позиции с устаревшим quote, которые уже снижают точность оценки.",
      format: "compact",
      tone: stalePriceCount > 0 ? "negative" : "neutral",
    },
    {
      id: "low-confidence",
      label: "Слабая оценка",
      value: lowConfidenceValuationCount,
      hint: "Позиции с unknown/manual_low pricing status, где оценка требует проверки.",
      format: "compact",
      tone: lowConfidenceValuationCount > 0 ? "negative" : "neutral",
    },
  ];

  const history = buildHistorySeries({
    positions: options.positions,
    transactions: options.transactions,
    snapshots: options.snapshots,
    currentAccounting,
  });

  const warnings = [...history.warnings];
  if (stalePriceCount > 0) {
    warnings.push(`${stalePriceCount} позиций используют устаревший quote и могут искажать текущую аналитику.`);
  }
  if (lowConfidenceValuationCount > 0) {
    warnings.push(`${lowConfidenceValuationCount} позиций зависят от low-confidence или missing valuation.`);
  }
  if (options.positions.some((position) => position.category === "custom" || position.category === "nft")) {
    warnings.push("Позиции Custom и NFT группируются в Other внутри исторической аналитики по классам активов.");
  }

  return {
    cards,
    realizedPnl: totalRealizedPnl,
    unrealizedPnl: totalUnrealizedPnl,
    totalRoi,
    winPositions,
    lossPositions,
    stalePriceCount,
    lowConfidenceValuationCount,
    concentrationRisk: {
      maxPositionWeight,
      topThreeWeight,
      summary: buildConcentrationSummary(maxPositionWeight, topThreeWeight),
    },
    topPositions,
    riskWatchlist,
    totalValueHistory: history.totalValueHistory,
    assetClassHistory: history.assetClassHistory,
    totalPnlHistory: history.totalPnlHistory,
    warnings,
  };
}





