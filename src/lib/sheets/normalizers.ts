import {
  getFieldAliases,
  getMissingRequiredFields,
  getWorkbookSheet,
  normalizeSheetHeader,
} from "@/lib/sheets/schema";
import { parseNumberish, toSlugFragment } from "@/lib/utils";
import type { Cs2AssetType, SheetRowRef } from "@/types/portfolio";

export type SheetCellValue = string | number | boolean | null | undefined;

export interface RawSpreadsheetWorkbook {
  spreadsheetTitle?: string;
  sheets: Record<string, SheetCellValue[][]>;
  availableSheets: string[];
}

export interface NormalizedSummaryRow {
  metric: string;
  value: string;
}

export interface NormalizedCs2Row {
  id: string;
  name: string;
  type: Cs2AssetType;
  quantity: number;
  wear: string | null;
  averageEntryPrice: number | null;
  manualCurrentPrice?: number | null;
  currentPrice: number | null;
  sheetPriceSource?: string | null;
  currency?: string | null;
  status?: string | null;
  category?: string | null;
  lastUpdated?: string | null;
  notes: string | null;
  market: string | null;
  manualRiskScore: number | null;
  liquidityLabel: string | null;
  sheetRef: SheetRowRef;
}

export interface NormalizedTelegramGiftRow {
  id: string;
  name: string;
  quantity: number;
  estimatedPrice: number | null;
  estimatedPriceQuoteSymbol: string | null;
  entryPrice?: number | null;
  manualCurrentPrice?: number | null;
  currentPrice?: number | null;
  collection?: string | null;
  priceConfidence?: string | null;
  liquidityNote?: string | null;
  status?: string | null;
  lastUpdated?: string | null;
  priceSource?: string | null;
  notes: string | null;
  sheetRef: SheetRowRef;
}

export interface NormalizedCryptoRow {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  averageEntryPrice: number | null;
  currentPrice: number | null;
  priceSource?: string | null;
  walletNote?: string | null;
  status?: string | null;
  currency?: string | null;
  lastUpdated?: string | null;
  notes: string | null;
  sheetRef: SheetRowRef;
}

export interface NormalizedTransactionRow {
  id: string;
  date: string | null;
  assetType: string | null;
  assetName: string | null;
  action: string | null;
  quantity: number | null;
  price: number | null;
  fees: number | null;
  currency: string | null;
  notes: string | null;
  sheetRef: SheetRowRef;
}

export interface NormalizedPortfolioHistoryRow {
  date: string | null;
  totalValue: number | null;
  cs2Value: number | null;
  telegramValue: number | null;
  cryptoValue: number | null;
  totalPnl: number | null;
  notes: string | null;
}

export interface NormalizedAuditLogRow {
  date: string | null;
  userAction: string | null;
  entityType: string | null;
  entityId: string | null;
  before: string | null;
  after: string | null;
  notes: string | null;
}

export interface NormalizedWorkbook {
  spreadsheetTitle?: string;
  availableSheets: string[];
  warnings: string[];
  summaryRows: NormalizedSummaryRow[];
  cs2Rows: NormalizedCs2Row[];
  telegramRows: NormalizedTelegramGiftRow[];
  cryptoRows: NormalizedCryptoRow[];
  transactionRows: NormalizedTransactionRow[];
  portfolioHistoryRows: NormalizedPortfolioHistoryRow[];
  auditLogRows: NormalizedAuditLogRow[];
  settings: Record<string, string>;
}

type SheetRow = Record<string, SheetCellValue>;

function cleanString(value: SheetCellValue) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function buildSheetRef(sheetName: string, rowIndex: number, isCanonical: boolean): SheetRowRef {
  return {
    sheetName,
    rowNumber: rowIndex + 2,
    isCanonical,
  };
}

function sheetToRows(values?: SheetCellValue[][]) {
  if (!values || values.length === 0) {
    return [] as SheetRow[];
  }

  const [headerRow, ...dataRows] = values;
  const headers = headerRow.map((cell, index) => {
    const normalized = normalizeSheetHeader(cell);
    return normalized || `column_${index + 1}`;
  });

  return dataRows
    .filter((row) => row.some((cell) => cleanString(cell) !== null))
    .map((row) => {
      return headers.reduce<SheetRow>((record, header, index) => {
        record[header] = row[index];
        return record;
      }, {});
    });
}

function getCell(row: SheetRow, aliases: string[]) {
  for (const alias of aliases.map((value) => normalizeSheetHeader(value))) {
    if (alias in row) {
      return row[alias];
    }
  }

  return null;
}

function getString(row: SheetRow, aliases: string[]) {
  return cleanString(getCell(row, aliases));
}

function getNumber(row: SheetRow, aliases: string[]) {
  return parseNumberish(getCell(row, aliases));
}

function normalizeCs2Type(value: string | null, name?: string | null): Cs2AssetType {
  const normalized = normalizeSheetHeader(value ?? "");
  const normalizedName = normalizeSheetHeader(name ?? "");

  if (normalizedName.includes("graffiti") || normalizedName.includes("граффити")) {
    return "graffiti";
  }

  if (
    ["sticker", "stickers", "наклейка", "наклейки"].includes(normalized) ||
    normalizedName.includes("sticker") ||
    normalizedName.includes("наклейка")
  ) {
    return "stickers";
  }

  if (["skin", "skins", "skins_knives", "скин", "скины"].includes(normalized)) {
    return "skins";
  }

  if (
    ["case", "cases", "container", "containers", "capsule", "capsules", "кейс", "кейсы"].includes(
      normalized,
    ) ||
    normalizedName.includes("case") ||
    normalizedName.includes("capsule") ||
    normalizedName.includes("кейс") ||
    normalizedName.includes("капсула")
  ) {
    return "cases";
  }

  if (
    ["charm", "charms", "keychain", "keychains", "брелок", "брелки"].includes(normalized) ||
    normalizedName.includes("брелок") ||
    normalizedName.includes("keychain") ||
    normalizedName.includes("charm")
  ) {
    return "charms";
  }

  if (["graffiti", "граффити"].includes(normalized)) {
    return "graffiti";
  }

  return "other";
}

function normalizeSummary(values?: SheetCellValue[][]) {
  const rows = sheetToRows(values);
  if (rows.length > 0) {
    return rows
      .map((row) => ({
        metric: getString(row, getFieldAliases("Summary", "metric")) ?? "",
        value: getString(row, getFieldAliases("Summary", "value")) ?? "",
      }))
      .filter((row) => row.metric);
  }

  if (!values) {
    return [] as NormalizedSummaryRow[];
  }

  return values
    .filter((row) => cleanString(row[0]) !== null && cleanString(row[1]) !== null)
    .map((row) => ({
      metric: cleanString(row[0]) ?? "",
      value: cleanString(row[1]) ?? "",
    }));
}

function normalizeSettings(values?: SheetCellValue[][]) {
  const rows = sheetToRows(values);

  return rows.reduce<Record<string, string>>((settings, row) => {
    const key = getString(row, getFieldAliases("Settings", "key"));
    const value = getString(row, getFieldAliases("Settings", "value"));

    if (key && value) {
      settings[key] = value;
    }

    return settings;
  }, {});
}

function buildCs2Notes(row: SheetRow) {
  const explicitNotes = getString(row, getFieldAliases("CS2_Positions", "notes"));
  if (explicitNotes) {
    return explicitNotes;
  }

  const rarity = getString(row, getFieldAliases("CS2_Positions", "rarity"));
  const wear = getString(row, getFieldAliases("CS2_Positions", "wear"));

  const details = [
    rarity ? `Редкость: ${rarity}` : null,
    wear ? `Состояние: ${wear}` : null,
  ].filter((value): value is string => Boolean(value));

  return details.length > 0 ? details.join(" | ") : null;
}

function normalizeCs2Rows(
  values: SheetCellValue[][] | undefined,
  sheetName: string,
  isCanonical: boolean,
) {
  const normalizedRows: NormalizedCs2Row[] = [];

  for (const [index, row] of sheetToRows(values).entries()) {
    const name = getString(row, getFieldAliases("CS2_Positions", "assetName"));
    if (!name) {
      continue;
    }

    const explicitCurrentPrice = getNumber(row, getFieldAliases("CS2_Positions", "currentPrice"));
    const manualCurrentPrice = getNumber(row, getFieldAliases("CS2_Positions", "manualCurrentPrice"));

    normalizedRows.push({
      id:
        getString(row, getFieldAliases("CS2_Positions", "id")) ??
        toSlugFragment(`cs2-${name}-${index + 1}`),
      name,
      type: normalizeCs2Type(
        getString(row, getFieldAliases("CS2_Positions", "assetType")) ??
          getString(row, getFieldAliases("CS2_Positions", "category")),
        name,
      ),
      category: getString(row, getFieldAliases("CS2_Positions", "category")),
      quantity: getNumber(row, getFieldAliases("CS2_Positions", "quantity")) ?? 0,
      wear: getString(row, getFieldAliases("CS2_Positions", "wear")),
      averageEntryPrice: getNumber(row, getFieldAliases("CS2_Positions", "entryPrice")),
      manualCurrentPrice,
      currentPrice: explicitCurrentPrice ?? manualCurrentPrice,
      sheetPriceSource: getString(row, getFieldAliases("CS2_Positions", "priceSource")),
      currency: getString(row, getFieldAliases("CS2_Positions", "currency")),
      status: getString(row, getFieldAliases("CS2_Positions", "status")),
      lastUpdated: getString(row, getFieldAliases("CS2_Positions", "lastUpdated")),
      notes: buildCs2Notes(row),
      market: getString(row, getFieldAliases("CS2_Positions", "market")),
      manualRiskScore: getNumber(row, getFieldAliases("CS2_Positions", "riskScore")),
      liquidityLabel: getString(row, getFieldAliases("CS2_Positions", "liquidityLabel")),
      sheetRef: buildSheetRef(sheetName, index, isCanonical),
    });
  }

  return normalizedRows;
}

function normalizeTelegramRows(
  values: SheetCellValue[][] | undefined,
  sheetName: string,
  isCanonical: boolean,
) {
  const normalizedRows: NormalizedTelegramGiftRow[] = [];

  for (const [index, row] of sheetToRows(values).entries()) {
    const name = getString(row, getFieldAliases("Telegram_Gifts", "giftName"));
    if (!name) {
      continue;
    }

    const currentPrice = getNumber(row, getFieldAliases("Telegram_Gifts", "currentPrice"));
    const manualCurrentPrice = getNumber(row, getFieldAliases("Telegram_Gifts", "manualCurrentPrice"));
    const tonPrice = getNumber(row, getFieldAliases("Telegram_Gifts", "priceTon"));

    normalizedRows.push({
      id:
        getString(row, getFieldAliases("Telegram_Gifts", "id")) ??
        toSlugFragment(`telegram-${name}-${index + 1}`),
      name,
      collection: getString(row, getFieldAliases("Telegram_Gifts", "collection")),
      quantity: getNumber(row, getFieldAliases("Telegram_Gifts", "quantity")) ?? 0,
      entryPrice: getNumber(row, getFieldAliases("Telegram_Gifts", "entryPrice")),
      manualCurrentPrice,
      currentPrice,
      estimatedPrice: currentPrice ?? manualCurrentPrice ?? tonPrice,
      estimatedPriceQuoteSymbol:
        currentPrice !== null || manualCurrentPrice !== null
          ? null
          : tonPrice !== null
            ? "TON"
            : null,
      priceConfidence: getString(row, getFieldAliases("Telegram_Gifts", "priceConfidence")),
      liquidityNote: getString(row, getFieldAliases("Telegram_Gifts", "liquidityNote")),
      status: getString(row, getFieldAliases("Telegram_Gifts", "status")),
      lastUpdated: getString(row, getFieldAliases("Telegram_Gifts", "lastUpdated")),
      priceSource:
        getString(row, ["price_source", "priceSource", "source"]) ??
        (tonPrice !== null
          ? "ton_sheet"
          : manualCurrentPrice !== null || currentPrice !== null
            ? "manual_sheet"
            : null),
      notes: getString(row, getFieldAliases("Telegram_Gifts", "notes")),
      sheetRef: buildSheetRef(sheetName, index, isCanonical),
    });
  }

  return normalizedRows;
}

function normalizeCryptoRows(
  values: SheetCellValue[][] | undefined,
  sheetName: string,
  isCanonical: boolean,
) {
  const normalizedRows: NormalizedCryptoRow[] = [];

  for (const [index, row] of sheetToRows(values).entries()) {
    const symbol = getString(row, getFieldAliases("Crypto", "symbol"));
    if (!symbol) {
      continue;
    }

    normalizedRows.push({
      id:
        getString(row, getFieldAliases("Crypto", "id")) ??
        toSlugFragment(`crypto-${symbol}-${index + 1}`),
      symbol: symbol.toUpperCase(),
      name: getString(row, getFieldAliases("Crypto", "name")) ?? symbol.toUpperCase(),
      quantity: getNumber(row, getFieldAliases("Crypto", "quantity")) ?? 0,
      averageEntryPrice: getNumber(row, getFieldAliases("Crypto", "entryPrice")),
      currentPrice: getNumber(row, getFieldAliases("Crypto", "currentPrice")),
      priceSource: getString(row, getFieldAliases("Crypto", "priceSource")),
      walletNote: getString(row, getFieldAliases("Crypto", "walletNote")),
      status: getString(row, getFieldAliases("Crypto", "status")),
      currency: getString(row, getFieldAliases("Crypto", "currency")),
      lastUpdated: getString(row, getFieldAliases("Crypto", "lastUpdated")),
      notes: getString(row, getFieldAliases("Crypto", "notes")),
      sheetRef: buildSheetRef(sheetName, index, isCanonical),
    });
  }

  return normalizedRows;
}

function normalizeTransactions(
  values: SheetCellValue[][] | undefined,
  sheetName: string,
  isCanonical: boolean,
) {
  return sheetToRows(values).map((row, index) => ({
    id:
      getString(row, getFieldAliases("Transactions", "id")) ??
      toSlugFragment(`tx-${index + 1}`),
    date: getString(row, getFieldAliases("Transactions", "date")),
    assetType: getString(row, getFieldAliases("Transactions", "assetType")),
    assetName: getString(row, getFieldAliases("Transactions", "assetName")),
    action: getString(row, getFieldAliases("Transactions", "action")),
    quantity: getNumber(row, getFieldAliases("Transactions", "quantity")),
    price: getNumber(row, getFieldAliases("Transactions", "price")),
    fees: getNumber(row, getFieldAliases("Transactions", "fees")),
    currency: getString(row, getFieldAliases("Transactions", "currency")),
    notes: getString(row, getFieldAliases("Transactions", "notes")),
    sheetRef: buildSheetRef(sheetName, index, isCanonical),
  }));
}

function normalizePortfolioHistory(values?: SheetCellValue[][]) {
  return sheetToRows(values).map((row) => ({
    date: getString(row, getFieldAliases("Portfolio_History", "date")),
    totalValue: getNumber(row, getFieldAliases("Portfolio_History", "totalValue")),
    cs2Value: getNumber(row, getFieldAliases("Portfolio_History", "cs2Value")),
    telegramValue: getNumber(row, getFieldAliases("Portfolio_History", "telegramValue")),
    cryptoValue: getNumber(row, getFieldAliases("Portfolio_History", "cryptoValue")),
    totalPnl: getNumber(row, getFieldAliases("Portfolio_History", "totalPnl")),
    notes: getString(row, getFieldAliases("Portfolio_History", "notes")),
  }));
}

function normalizeAuditLog(values?: SheetCellValue[][]) {
  return sheetToRows(values).map((row) => ({
    date: getString(row, getFieldAliases("Audit_Log", "date")),
    userAction: getString(row, getFieldAliases("Audit_Log", "userAction")),
    entityType: getString(row, getFieldAliases("Audit_Log", "entityType")),
    entityId: getString(row, getFieldAliases("Audit_Log", "entityId")),
    before: getString(row, getFieldAliases("Audit_Log", "before")),
    after: getString(row, getFieldAliases("Audit_Log", "after")),
    notes: getString(row, getFieldAliases("Audit_Log", "notes")),
  }));
}

function pushCanonicalColumnWarnings(
  warnings: string[],
  logicalSheetName:
    | "Summary"
    | "CS2_Positions"
    | "Telegram_Gifts"
    | "Crypto"
    | "Transactions"
    | "Portfolio_History"
    | "Settings"
    | "Audit_Log",
  values?: SheetCellValue[][],
  isCanonical = false,
) {
  if (!values || !isCanonical) {
    return;
  }

  const missingFields = getMissingRequiredFields(logicalSheetName, values);
  if (missingFields.length === 0) {
    return;
  }

  warnings.push(
    `Лист ${logicalSheetName} не содержит обязательные колонки: ${missingFields.join(", ")}.`,
  );
}

export function normalizeWorkbook(workbook: RawSpreadsheetWorkbook): NormalizedWorkbook {
  const warnings: string[] = [];

  const summarySheet = getWorkbookSheet(workbook, "Summary");
  const cs2Sheet = getWorkbookSheet(workbook, "CS2_Positions");
  const telegramSheet = getWorkbookSheet(workbook, "Telegram_Gifts");
  const cryptoSheet = getWorkbookSheet(workbook, "Crypto");
  const transactionsSheet = getWorkbookSheet(workbook, "Transactions");
  const historySheet = getWorkbookSheet(workbook, "Portfolio_History");
  const settingsSheet = getWorkbookSheet(workbook, "Settings");
  const auditSheet = getWorkbookSheet(workbook, "Audit_Log");

  if (!summarySheet.values) {
    warnings.push("Не найден лист Summary.");
  }

  if (!cs2Sheet.values && !telegramSheet.values && !cryptoSheet.values) {
    warnings.push(
      "Не найдено ни одного поддерживаемого листа активов. Ожидаются: CS2_Positions / CS2 Assets, Telegram_Gifts / Telegram Gifts, Crypto.",
    );
  }

  pushCanonicalColumnWarnings(warnings, "Summary", summarySheet.values, summarySheet.isCanonical);
  pushCanonicalColumnWarnings(warnings, "CS2_Positions", cs2Sheet.values, cs2Sheet.isCanonical);
  pushCanonicalColumnWarnings(warnings, "Telegram_Gifts", telegramSheet.values, telegramSheet.isCanonical);
  pushCanonicalColumnWarnings(warnings, "Crypto", cryptoSheet.values, cryptoSheet.isCanonical);
  pushCanonicalColumnWarnings(warnings, "Transactions", transactionsSheet.values, transactionsSheet.isCanonical);
  pushCanonicalColumnWarnings(warnings, "Portfolio_History", historySheet.values, historySheet.isCanonical);
  pushCanonicalColumnWarnings(warnings, "Settings", settingsSheet.values, settingsSheet.isCanonical);
  pushCanonicalColumnWarnings(warnings, "Audit_Log", auditSheet.values, auditSheet.isCanonical);

  return {
    spreadsheetTitle: workbook.spreadsheetTitle,
    availableSheets: workbook.availableSheets,
    warnings,
    summaryRows: normalizeSummary(summarySheet.values),
    cs2Rows: normalizeCs2Rows(
      cs2Sheet.values,
      cs2Sheet.matchedName ?? "CS2_Positions",
      cs2Sheet.isCanonical,
    ),
    telegramRows: normalizeTelegramRows(
      telegramSheet.values,
      telegramSheet.matchedName ?? "Telegram_Gifts",
      telegramSheet.isCanonical,
    ),
    cryptoRows: normalizeCryptoRows(
      cryptoSheet.values,
      cryptoSheet.matchedName ?? "Crypto",
      cryptoSheet.isCanonical,
    ),
    transactionRows: normalizeTransactions(
      transactionsSheet.values,
      transactionsSheet.matchedName ?? "Transactions",
      transactionsSheet.isCanonical,
    ),
    portfolioHistoryRows: normalizePortfolioHistory(historySheet.values),
    auditLogRows: normalizeAuditLog(auditSheet.values),
    settings: normalizeSettings(settingsSheet.values),
  };
}

