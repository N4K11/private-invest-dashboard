import { REQUIRED_SHEET_TABS } from "@/lib/constants";
import { parseNumberish, toSlugFragment } from "@/lib/utils";
import type { Cs2AssetType } from "@/types/portfolio";

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
  averageEntryPrice: number | null;
  currentPrice: number | null;
  notes: string | null;
  market: string | null;
  manualRiskScore: number | null;
  liquidityLabel: string | null;
}

export interface NormalizedTelegramGiftRow {
  id: string;
  name: string;
  quantity: number;
  estimatedPrice: number | null;
  notes: string | null;
}

export interface NormalizedCryptoRow {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  averageEntryPrice: number | null;
  currentPrice: number | null;
  notes: string | null;
}

export interface NormalizedTransactionRow {
  id: string;
  date: string | null;
  category: string | null;
  asset: string | null;
  quantity: number | null;
  price: number | null;
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
  settings: Record<string, string>;
}

type SheetRow = Record<string, SheetCellValue>;

function normalizeHeader(value: SheetCellValue) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
}

function cleanString(value: SheetCellValue) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function sheetToRows(values?: SheetCellValue[][]) {
  if (!values || values.length === 0) {
    return [] as SheetRow[];
  }

  const [headerRow, ...dataRows] = values;
  const headers = headerRow.map((cell, index) => {
    const normalized = normalizeHeader(cell);
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
  for (const alias of aliases.map((value) => normalizeHeader(value))) {
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

function normalizeCs2Type(value: string | null): Cs2AssetType {
  const normalized = normalizeHeader(value ?? "");

  if (["sticker", "stickers", "наклейка", "наклейки"].includes(normalized)) {
    return "stickers";
  }

  if (["skin", "skins", "скин", "скины"].includes(normalized)) {
    return "skins";
  }

  if (["case", "cases", "кейс", "кейсы"].includes(normalized)) {
    return "cases";
  }

  if (["charm", "charms", "брелок", "брелки"].includes(normalized)) {
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
        metric:
          getString(row, ["metric", "key", "name", "метрика", "показатель"]) ??
          "",
        value: getString(row, ["value", "значение"]) ?? "",
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
    const key = getString(row, ["key", "setting", "name", "ключ"]);
    const value = getString(row, ["value", "значение"]);

    if (key && value) {
      settings[key] = value;
    }

    return settings;
  }, {});
}

function normalizeCs2Rows(values?: SheetCellValue[][]) {
  return sheetToRows(values)
    .map((row, index) => {
      const name = getString(row, ["name", "item_name", "asset_name", "название", "предмет"]);
      if (!name) {
        return null;
      }

      return {
        id: toSlugFragment(`cs2-${name}-${index + 1}`),
        name,
        type: normalizeCs2Type(
          getString(row, ["type", "category", "asset_type", "тип", "категория"]),
        ),
        quantity:
          getNumber(row, ["quantity", "qty", "amount", "count", "количество"]) ?? 0,
        averageEntryPrice: getNumber(row, [
          "average_entry_price",
          "avg_entry_price",
          "entry_price",
          "buy_price",
          "средняя_цена_входа",
          "цена_входа",
        ]),
        currentPrice: getNumber(row, [
          "current_price",
          "market_price",
          "price_now",
          "текущая_цена",
          "цена_сейчас",
        ]),
        notes: getString(row, ["notes", "comment", "заметки", "комментарий"]),
        market: getString(row, ["market", "exchange", "source_market", "рынок"]),
        manualRiskScore: getNumber(row, [
          "risk_score",
          "illiquidity_score",
          "риск",
          "риск_скор",
        ]),
        liquidityLabel: getString(row, [
          "liquidity",
          "liquidity_label",
          "ликвидность",
        ]),
      } satisfies NormalizedCs2Row;
    })
    .filter((row): row is NormalizedCs2Row => Boolean(row));
}

function normalizeTelegramRows(values?: SheetCellValue[][]) {
  return sheetToRows(values)
    .map((row, index) => {
      const name = getString(row, ["name", "gift", "title", "название", "подарок"]);
      if (!name) {
        return null;
      }

      return {
        id: toSlugFragment(`telegram-${name}-${index + 1}`),
        name,
        quantity:
          getNumber(row, ["quantity", "qty", "amount", "count", "количество"]) ?? 0,
        estimatedPrice: getNumber(row, [
          "estimated_price",
          "price",
          "manual_price",
          "approx_price",
          "примерная_цена",
        ]),
        notes: getString(row, ["notes", "comment", "заметки", "комментарий"]),
      } satisfies NormalizedTelegramGiftRow;
    })
    .filter((row): row is NormalizedTelegramGiftRow => Boolean(row));
}

function normalizeCryptoRows(values?: SheetCellValue[][]) {
  return sheetToRows(values)
    .map((row, index) => {
      const symbol = getString(row, ["symbol", "ticker", "монета", "тикер"]);
      if (!symbol) {
        return null;
      }

      const name =
        getString(row, ["name", "asset", "coin_name", "название", "актив"]) ??
        symbol.toUpperCase();

      return {
        id: toSlugFragment(`crypto-${symbol}-${index + 1}`),
        symbol: symbol.toUpperCase(),
        name,
        quantity:
          getNumber(row, ["quantity", "qty", "amount", "count", "количество"]) ?? 0,
        averageEntryPrice: getNumber(row, [
          "average_entry_price",
          "avg_entry_price",
          "entry_price",
          "buy_price",
          "средняя_цена_входа",
          "цена_входа",
        ]),
        currentPrice: getNumber(row, [
          "current_price",
          "market_price",
          "текущая_цена",
        ]),
        notes: getString(row, ["notes", "comment", "заметки", "комментарий"]),
      } satisfies NormalizedCryptoRow;
    })
    .filter((row): row is NormalizedCryptoRow => Boolean(row));
}

function normalizeTransactions(values?: SheetCellValue[][]) {
  return sheetToRows(values).map((row, index) => ({
    id: toSlugFragment(`tx-${index + 1}`),
    date: getString(row, ["date", "datetime", "дата"]),
    category: getString(row, ["category", "тип", "категория"]),
    asset: getString(row, ["asset", "name", "актив", "название"]),
    quantity: getNumber(row, ["quantity", "qty", "количество"]),
    price: getNumber(row, ["price", "unit_price", "цена"]),
    notes: getString(row, ["notes", "comment", "заметки", "комментарий"]),
  }));
}

export function normalizeWorkbook(workbook: RawSpreadsheetWorkbook): NormalizedWorkbook {
  const warnings: string[] = [];

  for (const sheetName of REQUIRED_SHEET_TABS) {
    if (!workbook.availableSheets.includes(sheetName)) {
      warnings.push(`Missing sheet tab: ${sheetName}`);
    }
  }

  return {
    spreadsheetTitle: workbook.spreadsheetTitle,
    availableSheets: workbook.availableSheets,
    warnings,
    summaryRows: normalizeSummary(workbook.sheets.Summary),
    cs2Rows: normalizeCs2Rows(workbook.sheets.CS2_Positions),
    telegramRows: normalizeTelegramRows(workbook.sheets.Telegram_Gifts),
    cryptoRows: normalizeCryptoRows(workbook.sheets.Crypto),
    transactionRows: normalizeTransactions(workbook.sheets.Transactions),
    settings: normalizeSettings(workbook.sheets.Settings),
  };
}
