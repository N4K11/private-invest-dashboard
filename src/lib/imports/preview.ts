import "server-only";

import { normalizeWorkbook } from "@/lib/sheets/normalizers";
import { fetchSpreadsheetDocumentById } from "@/lib/sheets/client";
import type { ImportPreviewRequest } from "@/lib/imports/schema";
import {
  buildSuggestedMapping,
  csvTextToRows,
  deduplicateImportRecords,
  normalizeRawRows,
  parseSpreadsheetIdFromInput,
  rowToImportRecord,
  summarizeImportCategories,
} from "@/lib/imports/utils";
import type {
  ImportAssetCategory,
  ImportPreview,
  ImportPreviewRecord,
  ImportSourceType,
} from "@/types/imports";

const MANUAL_TEMPLATE_CSV = [
  "category,name,symbol,quantity,averageEntryPrice,currentPrice,notes,externalId,externalSource,collection",
  "crypto,Bitcoin,BTC,0.25,52000,64000,Manual template example,btc-wallet-1,manual,",
  "telegram,Plush Pepe,,3,45,80,Rare series,pepe-3,manual,Pepe Series",
  "cs2,Sticker | Crown (Foil),,2,900,1100,Example CS2 position,crown-foil,steam,",
].join("\n");

function buildPreviewResponse(options: {
  sourceType: ImportSourceType;
  sourceLabel: string;
  sourceSummary: string;
  warnings?: string[];
  availableColumns?: string[];
  suggestedMapping?: Partial<Record<string, string>>;
  mappingEditable?: boolean;
  records: ImportPreviewRecord[];
  sampleRows?: Record<string, string>[];
  totalSourceRows: number;
  duplicateRowCount: number;
}): ImportPreview {
  const importableRowCount = options.records.filter((record) => record.quantity > 0).length;

  return {
    sourceType: options.sourceType,
    sourceLabel: options.sourceLabel,
    sourceSummary: options.sourceSummary,
    mappingEditable: options.mappingEditable ?? false,
    availableColumns: options.availableColumns ?? [],
    suggestedMapping: options.suggestedMapping ?? {},
    warnings: options.warnings ?? [],
    totalSourceRows: options.totalSourceRows,
    duplicateRowCount: options.duplicateRowCount,
    importableRowCount,
    deduplicatedRecordCount: options.records.length,
    byCategory: summarizeImportCategories(options.records),
    records: options.records,
    sampleRows: options.sampleRows ?? options.records.slice(0, 5).map((record) => record.raw),
  };
}

function mapStructuredRowsToRecords(options: {
  sourceType: ImportSourceType;
  sourceLabel: string;
  rows: Array<{
    id: string;
    category: ImportAssetCategory;
    name: string;
    symbol?: string | null;
    quantity: number;
    averageEntryPrice?: number | null;
    currentPrice?: number | null;
    notes?: string | null;
    externalId?: string | null;
    externalSource?: string | null;
    collection?: string | null;
    raw: Record<string, string>;
  }>;
  warnings?: string[];
  sourceSummary: string;
}) {
  const { records, duplicateRowCount } = deduplicateImportRecords(
    options.rows.map((row) => ({
      id: `${options.sourceType}:${row.id}`,
      dedupeKey:
        row.externalSource && row.externalId
          ? `${row.category}:${row.externalSource}:${row.externalId}`
          : `${row.category}:${row.symbol ?? row.name}`.toLowerCase(),
      category: row.category,
      name: row.name,
      symbol: row.symbol ?? null,
      quantity: row.quantity,
      averageEntryPrice: row.averageEntryPrice ?? null,
      currentPrice: row.currentPrice ?? null,
      notes: row.notes ?? null,
      externalId: row.externalId ?? null,
      externalSource: row.externalSource ?? null,
      collection: row.collection ?? null,
      warnings: row.quantity <= 0 ? ["Количество равно нулю или не распознано."] : [],
      sourceRowIds: [row.id],
      raw: row.raw,
    })),
  );

  return buildPreviewResponse({
    sourceType: options.sourceType,
    sourceLabel: options.sourceLabel,
    sourceSummary: options.sourceSummary,
    warnings: options.warnings,
    mappingEditable: false,
    records,
    totalSourceRows: options.rows.length,
    duplicateRowCount,
  });
}

function previewFromWorkbook(input: ImportPreviewRequest, workbookLabel: string, workbook: ReturnType<typeof normalizeWorkbook>) {
  const structuredRows = [
    ...workbook.cs2Rows.map((row) => ({
      id: row.id,
      category: "cs2" as const,
      name: row.name,
      quantity: row.quantity,
      averageEntryPrice: row.averageEntryPrice,
      currentPrice: row.manualCurrentPrice ?? row.currentPrice,
      notes: row.notes,
      externalId: row.id,
      externalSource: "google_sheets",
      raw: {
        name: row.name,
        quantity: String(row.quantity),
        type: row.type,
        entryPrice: String(row.averageEntryPrice ?? ""),
        currentPrice: String(row.manualCurrentPrice ?? row.currentPrice ?? ""),
      },
    })),
    ...workbook.telegramRows.map((row) => ({
      id: row.id,
      category: "telegram" as const,
      name: row.name,
      quantity: row.quantity,
      averageEntryPrice: row.entryPrice ?? row.manualCurrentPrice ?? null,
      currentPrice: row.currentPrice ?? row.manualCurrentPrice ?? row.estimatedPrice ?? null,
      notes: row.notes,
      externalId: row.id,
      externalSource: "google_sheets",
      collection: row.collection ?? null,
      raw: {
        name: row.name,
        quantity: String(row.quantity),
        collection: row.collection ?? "",
        entryPrice: String(row.entryPrice ?? ""),
        currentPrice: String(row.currentPrice ?? row.manualCurrentPrice ?? row.estimatedPrice ?? ""),
      },
    })),
    ...workbook.cryptoRows.map((row) => ({
      id: row.id,
      category: "crypto" as const,
      name: row.name,
      symbol: row.symbol,
      quantity: row.quantity,
      averageEntryPrice: row.averageEntryPrice,
      currentPrice: row.currentPrice,
      notes: row.notes,
      externalId: row.symbol,
      externalSource: "google_sheets",
      raw: {
        name: row.name,
        symbol: row.symbol,
        quantity: String(row.quantity),
        entryPrice: String(row.averageEntryPrice ?? ""),
        currentPrice: String(row.currentPrice ?? ""),
      },
    })),
  ];

  return mapStructuredRowsToRecords({
    sourceType: input.sourceType,
    sourceLabel: workbookLabel,
    sourceSummary: `Google Sheets workbook: ${workbook.cs2Rows.length} CS2, ${workbook.telegramRows.length} Telegram, ${workbook.cryptoRows.length} Crypto`,
    warnings: workbook.warnings,
    rows: structuredRows,
  });
}

function extractArrayFromJson(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && typeof data === "object") {
    const candidate = data as Record<string, unknown>;

    for (const key of ["items", "positions", "assets", "data", "rows"]) {
      if (Array.isArray(candidate[key])) {
        return candidate[key] as unknown[];
      }
    }
  }

  return [];
}

function parseSteamInventoryData(data: unknown) {
  if (!data || typeof data !== "object") {
    return [] as Record<string, unknown>[];
  }

  const payload = data as Record<string, unknown>;

  if (Array.isArray(payload.assets) && Array.isArray(payload.descriptions)) {
    const descriptions = new Map<string, Record<string, unknown>>();

    for (const description of payload.descriptions as Record<string, unknown>[]) {
      const key = `${String(description.classid ?? "")}::${String(description.instanceid ?? "0")}`;
      descriptions.set(key, description);
    }

    return (payload.assets as Record<string, unknown>[]).map((asset, index) => {
      const descriptionKey = `${String(asset.classid ?? "")}::${String(asset.instanceid ?? "0")}`;
      const description = descriptions.get(descriptionKey) ?? {};

      return {
        category: "cs2",
        name:
          description.market_hash_name ??
          description.market_name ??
          description.name ??
          `Steam item ${index + 1}`,
        quantity: asset.amount ?? 1,
        externalId: asset.assetid ?? `${asset.classid ?? "item"}-${index + 1}`,
        externalSource: "steam",
        notes: description.type ?? "",
      };
    });
  }

  const rows = extractArrayFromJson(data);
  return rows.map((entry, index) => {
    const record = entry as Record<string, unknown>;
    return {
      category: "cs2",
      name:
        record.market_hash_name ??
        record.market_name ??
        record.name ??
        `Steam item ${index + 1}`,
      quantity: record.amount ?? record.quantity ?? record.count ?? 1,
      externalId: record.assetid ?? record.id ?? `${index + 1}`,
      externalSource: "steam",
      currentPrice: record.price ?? record.market_price ?? record.estimated_price ?? "",
      notes: record.type ?? record.marketable ?? "",
    };
  });
}

function previewFromTabularRows(options: {
  sourceType: ImportSourceType;
  sourceLabel: string;
  sourceSummary: string;
  rawRows: Record<string, unknown>[];
  mapping?: Partial<Record<string, string>>;
  defaultCategory?: ImportAssetCategory;
  defaultExternalSource?: string | null;
  warnings?: string[];
}) {
  const normalizedRows = normalizeRawRows(options.rawRows);
  const availableColumns = [...new Set(normalizedRows.flatMap((row) => Object.keys(row)))];
  const suggestedMapping = {
    ...buildSuggestedMapping(availableColumns),
    ...(options.mapping ?? {}),
  };

  const parsedRows = normalizedRows
    .map((row, index) =>
      rowToImportRecord({
        rowId: String(index + 1),
        row,
        sourceType: options.sourceType,
        mapping: suggestedMapping,
        defaultCategory: options.defaultCategory,
        defaultExternalSource: options.defaultExternalSource,
      }),
    )
    .filter((row): row is ImportPreviewRecord => Boolean(row));

  const { records, duplicateRowCount } = deduplicateImportRecords(parsedRows);

  const previewWarnings = [...(options.warnings ?? [])];
  if (!suggestedMapping.name || !suggestedMapping.quantity) {
    previewWarnings.push("Авто-mapping не нашел обязательные колонки name/quantity. Проверьте сопоставление полей.");
  }

  return buildPreviewResponse({
    sourceType: options.sourceType,
    sourceLabel: options.sourceLabel,
    sourceSummary: options.sourceSummary,
    warnings: previewWarnings,
    availableColumns,
    suggestedMapping,
    mappingEditable: true,
    records,
    sampleRows: normalizedRows.slice(0, 5),
    totalSourceRows: normalizedRows.length,
    duplicateRowCount,
  });
}

export async function buildImportPreview(input: ImportPreviewRequest) {
  if (input.sourceType === "google_sheets") {
    const spreadsheetId = parseSpreadsheetIdFromInput(input.spreadsheetIdOrUrl ?? "");
    const document = await fetchSpreadsheetDocumentById(spreadsheetId);
    const workbook = normalizeWorkbook(document.workbook);
    return previewFromWorkbook(input, document.fileName ?? document.workbook.spreadsheetTitle ?? spreadsheetId, workbook);
  }

  const content = input.content?.trim() ?? "";

  if (input.sourceType === "csv" || input.sourceType === "manual_template") {
    const rawRows = csvTextToRows(content || MANUAL_TEMPLATE_CSV);
    return previewFromTabularRows({
      sourceType: input.sourceType,
      sourceLabel: input.fileName ?? (input.sourceType === "manual_template" ? "Manual CSV template" : "CSV import"),
      sourceSummary: `${rawRows.length} строк распознано из ${input.sourceType === "manual_template" ? "ручного шаблона" : "CSV"}`,
      rawRows,
      mapping: input.mapping,
      defaultCategory: input.sourceType === "manual_template" ? "custom" : undefined,
      defaultExternalSource: input.sourceType === "manual_template" ? "manual" : null,
      warnings:
        input.sourceType === "manual_template"
          ? ["Manual template использует CSV-формат. При желании можно заменить категорию и цены перед импортом."]
          : [],
    });
  }

  const parsedJson = JSON.parse(content);

  if (input.sourceType === "steam_export") {
    const rawRows = parseSteamInventoryData(parsedJson);
    return previewFromTabularRows({
      sourceType: input.sourceType,
      sourceLabel: input.fileName ?? "Steam inventory export",
      sourceSummary: `${rawRows.length} строк распознано из Steam export`,
      rawRows,
      mapping: input.mapping,
      defaultCategory: "cs2",
      defaultExternalSource: "steam",
      warnings: ["Steam export импортируется как snapshot holdings. Исторические сделки не создаются."],
    });
  }

  const rawRows = extractArrayFromJson(parsedJson) as Record<string, unknown>[];
  return previewFromTabularRows({
    sourceType: input.sourceType,
    sourceLabel: input.fileName ?? "JSON import",
    sourceSummary: `${rawRows.length} строк распознано из JSON`,
    rawRows,
    mapping: input.mapping,
    warnings: rawRows.length === 0 ? ["JSON не содержит поддерживаемого массива items/positions/assets/data."] : [],
  });
}

export function getManualTemplateCsv() {
  return MANUAL_TEMPLATE_CSV;
}



