import * as XLSX from "xlsx";

import { CATEGORY_META } from "@/lib/constants";
import { parseNumberish, toSlugFragment } from "@/lib/utils";
import type {
  ImportAssetCategory,
  ImportColumnMapping,
  ImportFieldKey,
  ImportPreviewCategoryCount,
  ImportPreviewRecord,
  ImportSourceType,
} from "@/types/imports";

const FIELD_ALIASES: Record<ImportFieldKey, string[]> = {
  category: ["category", "asset_type", "type", "class", "asset category"],
  name: ["name", "asset_name", "gift_name", "market_hash_name", "title"],
  symbol: ["symbol", "ticker", "coin", "currency"],
  quantity: ["quantity", "qty", "amount", "count", "units"],
  averageEntryPrice: ["average_entry_price", "entry_price", "avg_entry", "buy_price", "cost_basis"],
  currentPrice: ["current_price", "price", "market_price", "estimated_price", "manual_current_price"],
  notes: ["notes", "note", "comment", "description"],
  externalId: ["external_id", "assetid", "id", "classid", "item_id"],
  externalSource: ["external_source", "source", "platform"],
  collection: ["collection", "series", "set"],
};

function normalizeHeader(value: string) {
  return toSlugFragment(String(value ?? "")).replace(/-/g, "_");
}

export function parseSpreadsheetIdFromInput(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? trimmed;
}

export function normalizeImportCategory(
  value: string | null | undefined,
  fallback: ImportAssetCategory = "custom",
) {
  const normalized = normalizeHeader(value ?? "");

  if (["cs2", "steam", "skins", "stickers", "cases"].includes(normalized)) {
    return "cs2";
  }

  if (["telegram", "telegram_gifts", "gift", "gifts", "telegramgift"].includes(normalized)) {
    return "telegram";
  }

  if (["crypto", "coin", "coins", "token", "tokens"].includes(normalized)) {
    return "crypto";
  }

  if (["nft", "collectible"].includes(normalized)) {
    return "nft";
  }

  if (["custom", "manual", "other"].includes(normalized)) {
    return "custom";
  }

  return fallback;
}

export function buildSuggestedMapping(columns: string[]) {
  const normalizedColumns = new Map(columns.map((column) => [normalizeHeader(column), column]));
  const mapping: ImportColumnMapping = {};

  (Object.keys(FIELD_ALIASES) as ImportFieldKey[]).forEach((field) => {
    const match = FIELD_ALIASES[field]
      .map((alias) => normalizedColumns.get(normalizeHeader(alias)))
      .find((value): value is string => Boolean(value));

    if (match) {
      mapping[field] = match;
    }
  });

  return mapping;
}

export function csvTextToRows(text: string) {
  const workbook = XLSX.read(text, { type: "string" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  return XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
  });
}

export function normalizeRawRows(rows: Record<string, unknown>[]) {
  return rows.map((row) => {
    return Object.entries(row).reduce<Record<string, string>>((accumulator, [key, value]) => {
      accumulator[String(key)] = value === null || value === undefined ? "" : String(value).trim();
      return accumulator;
    }, {});
  });
}

export function buildImportDedupeKey(record: {
  category: ImportAssetCategory;
  name: string;
  symbol?: string | null;
  externalId?: string | null;
  externalSource?: string | null;
}) {
  if (record.externalSource && record.externalId) {
    return `${record.category}:${normalizeHeader(record.externalSource)}:${normalizeHeader(record.externalId)}`;
  }

  if (record.category === "crypto" && record.symbol) {
    return `${record.category}:${normalizeHeader(record.symbol)}`;
  }

  return `${record.category}:${normalizeHeader(record.name)}`;
}

function mergeNotes(...values: Array<string | null | undefined>) {
  const unique = [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
  return unique.length > 0 ? unique.join(" | ") : null;
}

export function deduplicateImportRecords(records: ImportPreviewRecord[]) {
  const collection = new Map<string, ImportPreviewRecord>();
  let duplicateRowCount = 0;

  for (const record of records) {
    const existing = collection.get(record.dedupeKey);

    if (!existing) {
      collection.set(record.dedupeKey, record);
      continue;
    }

    duplicateRowCount += 1;
    collection.set(record.dedupeKey, {
      ...existing,
      quantity: existing.quantity + record.quantity,
      averageEntryPrice: record.averageEntryPrice ?? existing.averageEntryPrice,
      currentPrice: record.currentPrice ?? existing.currentPrice,
      notes: mergeNotes(existing.notes, record.notes),
      collection: record.collection ?? existing.collection,
      externalId: existing.externalId ?? record.externalId,
      externalSource: existing.externalSource ?? record.externalSource,
      warnings: [...new Set([...existing.warnings, ...record.warnings, "Внутри файла найдены дубли, quantity агрегирован."])],
      sourceRowIds: [...existing.sourceRowIds, ...record.sourceRowIds],
    });
  }

  return {
    records: [...collection.values()],
    duplicateRowCount,
  };
}

export function summarizeImportCategories(records: ImportPreviewRecord[]): ImportPreviewCategoryCount[] {
  const counts = new Map<ImportAssetCategory, number>();

  for (const record of records) {
    counts.set(record.category, (counts.get(record.category) ?? 0) + 1);
  }

  return [...counts.entries()].map(([category, count]) => ({
    category,
    count,
    label:
      category === "custom" || category === "nft"
        ? category.toUpperCase()
        : CATEGORY_META[category].label,
  }));
}

export function rowToImportRecord(options: {
  rowId: string;
  row: Record<string, string>;
  sourceType: ImportSourceType;
  mapping: ImportColumnMapping;
  defaultCategory?: ImportAssetCategory;
  defaultExternalSource?: string | null;
}) {
  const getValue = (field: ImportFieldKey) => {
    const column = options.mapping[field];
    return column ? options.row[column] ?? "" : "";
  };

  const name = getValue("name").trim();
  if (!name) {
    return null;
  }

  const category = normalizeImportCategory(getValue("category"), options.defaultCategory ?? "custom");
  const quantity = parseNumberish(getValue("quantity")) ?? 0;
  const averageEntryPrice = parseNumberish(getValue("averageEntryPrice"));
  const currentPrice = parseNumberish(getValue("currentPrice"));
  const symbolRaw = getValue("symbol").trim();
  const externalId = getValue("externalId").trim() || null;
  const externalSource = getValue("externalSource").trim() || options.defaultExternalSource || null;
  const notes = getValue("notes").trim() || null;
  const collection = getValue("collection").trim() || null;

  const warnings: string[] = [];
  if (quantity <= 0) {
    warnings.push("Количество равно нулю или не распознано.");
  }

  return {
    id: `${options.sourceType}:${options.rowId}`,
    dedupeKey: buildImportDedupeKey({
      category,
      name,
      symbol: symbolRaw || null,
      externalId,
      externalSource,
    }),
    category,
    name,
    symbol: symbolRaw ? symbolRaw.toUpperCase() : null,
    quantity,
    averageEntryPrice,
    currentPrice,
    notes,
    externalId,
    externalSource,
    collection,
    warnings,
    sourceRowIds: [options.rowId],
    raw: options.row,
  } satisfies ImportPreviewRecord;
}
