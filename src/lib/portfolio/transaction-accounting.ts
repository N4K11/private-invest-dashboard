import type { NormalizedTransactionRow } from "@/lib/sheets/normalizers";
import type {
  AssetCategory,
  QuantitySource,
  TransactionAction,
  TransactionRecord,
} from "@/types/portfolio";

type SupportedAction = TransactionAction;

export interface AssetAccountingResult {
  quantity: number;
  quantitySource: QuantitySource;
  averageEntryPrice: number | null;
  totalCost: number;
  totalValue: number;
  realizedPnl: number;
  unrealizedPnl: number;
  pnl: number;
  pnlPercent: number | null;
  fees: number;
  transactionCount: number;
  investedCapital: number;
  currentPrice: number | null;
  latestPriceUpdate: number | null;
}

type ComputeAssetAccountingParams = {
  category: AssetCategory;
  assetNames: string[];
  sheetQuantity: number;
  fallbackEntryPrice: number | null;
  currentPrice: number | null;
  transactions: NormalizedTransactionRow[];
};

const QUANTITY_EPSILON = 0.0000001;

function normalizeFreeText(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[()]/g, " ")
    .replace(/[-–—]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTransactionAssetType(value: string | null | undefined): AssetCategory | null {
  const normalized = normalizeFreeText(value).replace(/\s+/g, "_");

  if (!normalized) {
    return null;
  }

  if (["cs2", "cs", "steam", "steam_items", "steam_item", "counter_strike", "counterstrike"].includes(normalized)) {
    return "cs2";
  }

  if (["telegram", "telegram_gifts", "telegram_gift", "gift", "gifts"].includes(normalized) || normalized.includes("telegram")) {
    return "telegram";
  }

  if (["crypto", "cryptocurrency", "coin", "coins", "token", "tokens"].includes(normalized)) {
    return "crypto";
  }

  return null;
}

export function normalizeTransactionAction(value: string | null | undefined): SupportedAction | null {
  const normalized = normalizeFreeText(value).replace(/\s+/g, "_");

  if (!normalized) {
    return null;
  }

  if (["buy", "purchase", "deposit", "покупка", "купил", "купить"].includes(normalized)) {
    return "buy";
  }

  if (["sell", "sale", "продажа", "продал", "продать"].includes(normalized)) {
    return "sell";
  }

  if (["transfer", "move", "bridge", "перевод", "трансфер", "перенос"].includes(normalized)) {
    return "transfer";
  }

  if (["price_update", "priceupdate", "mark", "mark_to_market", "update_price", "обновление_цены", "апдейт_цены"].includes(normalized)) {
    return "price_update";
  }

  if (["fee", "fees", "commission", "комиссия", "сбор"].includes(normalized)) {
    return "fee";
  }

  return null;
}

function getTransactionTimestamp(value: string | null, fallbackIndex: number) {
  if (!value) {
    return Number.MAX_SAFE_INTEGER - fallbackIndex;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER - fallbackIndex;
}

function sortTransactionsAscending(rows: NormalizedTransactionRow[]) {
  return [...rows].sort((left, right) => {
    const leftIndex = left.sheetRef?.rowNumber ?? 0;
    const rightIndex = right.sheetRef?.rowNumber ?? 0;
    return getTransactionTimestamp(left.date, leftIndex) - getTransactionTimestamp(right.date, rightIndex);
  });
}

function buildAliasSet(assetNames: string[]) {
  return new Set(assetNames.map((name) => normalizeFreeText(name)).filter((name) => name.length > 0));
}

function getMatchingTransactions(
  rows: NormalizedTransactionRow[],
  category: AssetCategory,
  assetNames: string[],
) {
  const aliases = buildAliasSet(assetNames);

  return rows.filter((row) => {
    const transactionCategory = normalizeTransactionAssetType(row.assetType);
    const transactionName = normalizeFreeText(row.assetName);

    return transactionCategory === category && aliases.has(transactionName);
  });
}

function sanitizeCurrencyPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function clampNearZero(value: number) {
  return Math.abs(value) < QUANTITY_EPSILON ? 0 : value;
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

export function buildTransactionRecords(rows: NormalizedTransactionRow[]): TransactionRecord[] {
  return [...rows]
    .sort((left, right) => {
      const leftIndex = left.sheetRef?.rowNumber ?? 0;
      const rightIndex = right.sheetRef?.rowNumber ?? 0;
      return getTransactionTimestamp(right.date, rightIndex) - getTransactionTimestamp(left.date, leftIndex);
    })
    .map((row) => ({
      id: row.id,
      date: row.date,
      assetType: normalizeTransactionAssetType(row.assetType),
      assetName: row.assetName,
      action: normalizeTransactionAction(row.action) ?? row.action ?? "unknown",
      quantity: row.quantity,
      price: row.price,
      fees: row.fees ?? 0,
      currency: row.currency,
      notes: row.notes,
      rowRef: row.sheetRef,
    }));
}

export function computeAssetAccounting(
  params: ComputeAssetAccountingParams,
): AssetAccountingResult {
  const matchedTransactions = sortTransactionsAscending(
    getMatchingTransactions(params.transactions, params.category, params.assetNames),
  );

  const fallbackUnitCost =
    params.fallbackEntryPrice ?? params.currentPrice ?? 0;

  if (matchedTransactions.length === 0) {
    const totalCost = params.sheetQuantity * fallbackUnitCost;
    const effectiveCurrentPrice = sanitizeCurrencyPrice(
      params.currentPrice ?? params.fallbackEntryPrice,
    );
    const totalValue = params.sheetQuantity * (effectiveCurrentPrice ?? 0);
    const unrealizedPnl = totalValue - totalCost;

    return {
      quantity: params.sheetQuantity,
      quantitySource: "sheet",
      averageEntryPrice: params.fallbackEntryPrice,
      totalCost,
      totalValue,
      realizedPnl: 0,
      unrealizedPnl,
      pnl: unrealizedPnl,
      pnlPercent: totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : null,
      fees: 0,
      transactionCount: 0,
      investedCapital: totalCost,
      currentPrice: effectiveCurrentPrice,
      latestPriceUpdate: null,
    };
  }

  let heldQuantity = 0;
  let heldCost = 0;
  let realizedPnl = 0;
  let fees = 0;
  let investedCapital = 0;
  let latestPriceUpdate: number | null = null;
  let inventoryTransactionCount = 0;

  for (const transaction of matchedTransactions) {
    const action = normalizeTransactionAction(transaction.action);
    const price = sanitizeCurrencyPrice(transaction.price);
    const quantity = Number.isFinite(transaction.quantity ?? null) ? Math.abs(transaction.quantity ?? 0) : 0;
    const feeAmount = Math.max(0, transaction.fees ?? 0);

    if (action === "buy") {
      if (quantity <= 0) {
        continue;
      }

      const unitCost = price ?? params.fallbackEntryPrice ?? latestPriceUpdate ?? params.currentPrice ?? 0;
      heldQuantity += quantity;
      heldCost += quantity * unitCost + feeAmount;
      realizedPnl -= 0;
      fees += feeAmount;
      investedCapital += quantity * unitCost + feeAmount;
      inventoryTransactionCount += 1;
      continue;
    }

    if (action === "sell") {
      if (quantity <= 0) {
        continue;
      }

      const sellPrice = price ?? latestPriceUpdate ?? params.currentPrice ?? params.fallbackEntryPrice ?? 0;
      const removal = removeInventory({
        requestedQuantity: quantity,
        heldQuantity,
        heldCost,
        fallbackUnitCost,
      });

      heldQuantity = removal.nextQuantity;
      heldCost = removal.nextCost;
      realizedPnl += quantity * sellPrice - feeAmount - removal.costRemoved;
      fees += feeAmount;
      inventoryTransactionCount += 1;
      continue;
    }

    if (action === "transfer") {
      const signedQuantity = transaction.quantity ?? 0;
      if (!Number.isFinite(signedQuantity) || Math.abs(signedQuantity) <= QUANTITY_EPSILON) {
        continue;
      }

      if (signedQuantity > 0) {
        const unitCost = price ?? params.fallbackEntryPrice ?? latestPriceUpdate ?? params.currentPrice ?? 0;
        heldQuantity += signedQuantity;
        heldCost += signedQuantity * unitCost + feeAmount;
        investedCapital += signedQuantity * unitCost + feeAmount;
      } else {
        const removal = removeInventory({
          requestedQuantity: Math.abs(signedQuantity),
          heldQuantity,
          heldCost,
          fallbackUnitCost,
        });

        heldQuantity = removal.nextQuantity;
        heldCost = removal.nextCost;
      }

      fees += feeAmount;
      inventoryTransactionCount += 1;
      continue;
    }

    if (action === "price_update") {
      if (price !== null) {
        latestPriceUpdate = price;
      }

      if (feeAmount > 0) {
        fees += feeAmount;
        realizedPnl -= feeAmount;
      }
      continue;
    }

    if (action === "fee") {
      const standaloneFee = feeAmount > 0 ? feeAmount : Math.max(0, price ?? 0);
      if (standaloneFee > 0) {
        fees += standaloneFee;
        realizedPnl -= standaloneFee;
      }
    }
  }

  heldQuantity = clampNearZero(heldQuantity);
  heldCost = clampNearZero(heldCost);

  let quantitySource: QuantitySource = inventoryTransactionCount > 0 ? "transactions" : "sheet";

  if (params.sheetQuantity - heldQuantity > QUANTITY_EPSILON) {
    const missingQuantity = params.sheetQuantity - heldQuantity;
    const syntheticUnitCost =
      params.fallbackEntryPrice ??
      (heldQuantity > QUANTITY_EPSILON ? heldCost / heldQuantity : latestPriceUpdate ?? params.currentPrice ?? 0);

    heldQuantity += missingQuantity;
    heldCost += missingQuantity * syntheticUnitCost;
    investedCapital += missingQuantity * syntheticUnitCost;
    quantitySource = "sheet";
  }

  const averageEntryPrice = heldQuantity > QUANTITY_EPSILON ? heldCost / heldQuantity : params.fallbackEntryPrice;
  const effectiveCurrentPrice = sanitizeCurrencyPrice(
    params.currentPrice ?? latestPriceUpdate ?? averageEntryPrice,
  );
  const totalValue = heldQuantity * (effectiveCurrentPrice ?? 0);
  const unrealizedPnl = totalValue - heldCost;
  const pnl = realizedPnl + unrealizedPnl;
  const roiBase = investedCapital > QUANTITY_EPSILON ? investedCapital : heldCost;

  return {
    quantity: heldQuantity,
    quantitySource,
    averageEntryPrice,
    totalCost: heldCost,
    totalValue,
    realizedPnl,
    unrealizedPnl,
    pnl,
    pnlPercent: roiBase > QUANTITY_EPSILON ? (pnl / roiBase) * 100 : null,
    fees,
    transactionCount: matchedTransactions.length,
    investedCapital: roiBase > QUANTITY_EPSILON ? investedCapital : heldCost,
    currentPrice: effectiveCurrentPrice,
    latestPriceUpdate,
  };
}
