import { Readable } from "node:stream";

import { google } from "googleapis";
import * as XLSX from "xlsx";

import { forgetRemembered, forgetRememberedByPrefix } from "@/lib/cache/ttl-store";
import { isGoogleSheetsConfigured } from "@/lib/env";
import {
  adminEntityTypeSchema,
  type AdminEntityType,
  type AdminMutationInput,
  type AdminTransactionMutationInput,
} from "@/lib/admin/schema";
import type { RawSpreadsheetWorkbook, SheetCellValue } from "@/lib/sheets/normalizers";
import {
  findMatchedSheetName,
  getFieldAliases,
  getSheetSchema,
  normalizeSheetHeader,
  type CanonicalSheetName,
} from "@/lib/sheets/schema";
import {
  createGoogleAuth,
  fetchSpreadsheetDocument,
  type SpreadsheetDocument,
  type SpreadsheetDocumentMode,
} from "@/lib/sheets/client";
import { toSlugFragment } from "@/lib/utils";

export interface AdminWriteStatus {
  enabled: boolean;
  canWrite: boolean;
  missingEditorAccess: boolean;
  mode: SpreadsheetDocumentMode | "unavailable";
  fileName: string | null;
  message: string | null;
}

export interface AdminMutationResult {
  entityId: string;
  entityType: AdminEntityType | "transaction";
  operation: "create" | "update";
  sheetName: string;
  rowNumber: number;
}

type HeaderMap = Record<string, number>;
type CanonicalRecord = Record<string, SheetCellValue>;

type MutableWorkbook = {
  spreadsheetTitle?: string;
  availableSheets: string[];
  sheets: Record<string, SheetCellValue[][]>;
};

const ENTITY_SHEET_MAP: Record<AdminEntityType, CanonicalSheetName> = {
  cs2: "CS2_Positions",
  telegram: "Telegram_Gifts",
  crypto: "Crypto",
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function toEditorAccessMessage(error?: unknown) {
  const message = getErrorMessage(error);

  if (/permission|insufficient|forbidden|not have permission|canEdit/i.test(message)) {
    return "Service account имеет только Viewer-доступ к файлу. Выдай ему роль Editor в Google Sheets или Google Drive перед использованием admin mode.";
  }

  return message;
}

function cloneWorkbook(workbook: RawSpreadsheetWorkbook): MutableWorkbook {
  return {
    spreadsheetTitle: workbook.spreadsheetTitle,
    availableSheets: [...workbook.availableSheets],
    sheets: Object.fromEntries(
      Object.entries(workbook.sheets).map(([sheetName, rows]) => [
        sheetName,
        rows.map((row) => [...row]),
      ]),
    ),
  };
}

function ensureSheetInWorkbook(workbook: MutableWorkbook, sheetName: string) {
  if (!workbook.availableSheets.includes(sheetName)) {
    workbook.availableSheets.push(sheetName);
  }

  if (!workbook.sheets[sheetName]) {
    workbook.sheets[sheetName] = [];
  }

  if (workbook.sheets[sheetName].length === 0) {
    workbook.sheets[sheetName].push([]);
  }

  return workbook.sheets[sheetName];
}

function ensureCellWidth(row: SheetCellValue[], width: number) {
  while (row.length < width) {
    row.push("");
  }
}

function getCanonicalHeaderMap(
  workbook: MutableWorkbook,
  sheetName: string,
  canonicalSheet: CanonicalSheetName,
) {
  const values = ensureSheetInWorkbook(workbook, sheetName);
  const headerRow = values[0] ?? [];
  const normalizedHeaders = new Map<string, number>();

  headerRow.forEach((cell, index) => {
    const normalized = normalizeSheetHeader(cell);
    if (normalized && !normalizedHeaders.has(normalized)) {
      normalizedHeaders.set(normalized, index);
    }
  });

  const headerMap: HeaderMap = {};

  for (const field of getSheetSchema(canonicalSheet).fields) {
    const aliasIndex = field.aliases
      .map((alias) => normalizedHeaders.get(normalizeSheetHeader(alias)))
      .find((value): value is number => value !== undefined);

    if (aliasIndex !== undefined) {
      headerMap[field.key] = aliasIndex;
      continue;
    }

    headerRow.push(field.key);
    headerMap[field.key] = headerRow.length - 1;
    normalizedHeaders.set(normalizeSheetHeader(field.key), headerRow.length - 1);
  }

  values[0] = headerRow;
  return { values, headerMap };
}

function getCellFromCanonicalRecord(
  headerRow: SheetCellValue[],
  row: SheetCellValue[],
  canonicalSheet: CanonicalSheetName,
  fieldKey: string,
) {
  const aliases = getFieldAliases(canonicalSheet, fieldKey);
  const indexes = headerRow
    .map((cell, index) => ({ key: normalizeSheetHeader(cell), index }))
    .filter(({ key }) => aliases.some((alias) => key === normalizeSheetHeader(alias)));

  if (indexes.length === 0) {
    return null;
  }

  return row[indexes[0].index] ?? null;
}

function buildCanonicalRecord(
  values: SheetCellValue[][],
  rowNumber: number,
  canonicalSheet: CanonicalSheetName,
) {
  const headerRow = values[0] ?? [];
  const row = values[rowNumber - 1] ?? [];

  return getSheetSchema(canonicalSheet).fields.reduce<CanonicalRecord>((record, field) => {
    record[field.key] = getCellFromCanonicalRecord(headerRow, row, canonicalSheet, field.key);
    return record;
  }, {});
}

function setRecordValues(
  values: SheetCellValue[][],
  rowNumber: number,
  headerMap: HeaderMap,
  nextRecord: CanonicalRecord,
) {
  const rowIndex = rowNumber - 1;

  while (values.length <= rowIndex) {
    values.push([]);
  }

  const headerWidth = values[0]?.length ?? Object.keys(headerMap).length;
  const nextRow = values[rowIndex] ?? [];
  ensureCellWidth(nextRow, headerWidth);

  for (const [key, columnIndex] of Object.entries(headerMap)) {
    const value = nextRecord[key];
    nextRow[columnIndex] = value ?? "";
  }

  values[rowIndex] = nextRow;
}

function ensureAuditLogSheet(workbook: MutableWorkbook) {
  const matchedName = findMatchedSheetName(workbook.availableSheets, "Audit_Log") ?? "Audit_Log";
  return {
    sheetName: matchedName,
    ...getCanonicalHeaderMap(workbook, matchedName, "Audit_Log"),
  };
}

function appendAuditLog(
  workbook: MutableWorkbook,
  params: {
    action: string;
    entityType: AdminEntityType | "transaction";
    entityId: string;
    before: CanonicalRecord | null;
    after: CanonicalRecord;
    notes: string;
  },
) {
  const { values, headerMap } = ensureAuditLogSheet(workbook);
  const nextRowNumber = values.length + 1;
  const timestamp = new Date().toISOString();

  setRecordValues(values, nextRowNumber, headerMap, {
    date: timestamp,
    userAction: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    before: params.before ? JSON.stringify(params.before) : "",
    after: JSON.stringify(params.after),
    notes: params.notes,
  });
}

function generateEntityId(entityType: AdminEntityType, primaryKey: string) {
  return toSlugFragment(`${entityType}-${primaryKey}-${Date.now().toString(36)}`);
}

function generateTransactionId(assetType: string, assetName: string) {
  return toSlugFragment(`tx-${assetType}-${assetName}-${Date.now().toString(36)}`);
}

function getEntitySheetName(workbook: MutableWorkbook, entityType: AdminEntityType) {
  return (
    findMatchedSheetName(workbook.availableSheets, ENTITY_SHEET_MAP[entityType]) ??
    ENTITY_SHEET_MAP[entityType]
  );
}

function getTransactionsSheetName(workbook: MutableWorkbook) {
  return findMatchedSheetName(workbook.availableSheets, "Transactions") ?? "Transactions";
}

function buildNextPositionRecord(
  input: AdminMutationInput,
  existingRecord: CanonicalRecord | null,
  timestamp: string,
) {
  if (input.entityType === "cs2") {
    return {
      id: existingRecord?.id ?? generateEntityId("cs2", input.data.name),
      assetType: input.data.assetType,
      assetName: input.data.name,
      category: input.data.category ?? input.data.assetType,
      quantity: input.data.quantity,
      entryPrice: input.data.entryPrice,
      manualCurrentPrice: input.data.manualCurrentPrice,
      currentPrice: input.data.manualCurrentPrice,
      priceSource:
        input.data.manualCurrentPrice !== null
          ? "manual_sheet"
          : existingRecord?.priceSource ?? "",
      currency: existingRecord?.currency ?? "USD",
      status: input.data.status,
      notes: input.data.notes ?? "",
      lastUpdated: timestamp,
      wear: existingRecord?.wear ?? "",
      rarity: existingRecord?.rarity ?? "",
      riskScore: existingRecord?.riskScore ?? "",
      liquidityLabel: existingRecord?.liquidityLabel ?? "",
      market: existingRecord?.market ?? "",
    } satisfies CanonicalRecord;
  }

  if (input.entityType === "telegram") {
    return {
      id: existingRecord?.id ?? generateEntityId("telegram", input.data.name),
      giftName: input.data.name,
      collection: input.data.collection ?? "",
      quantity: input.data.quantity,
      entryPrice: input.data.entryPrice,
      manualCurrentPrice: input.data.manualCurrentPrice,
      currentPrice: input.data.manualCurrentPrice,
      priceConfidence: input.data.priceConfidence ?? "",
      liquidityNote: input.data.liquidityNote ?? "",
      status: input.data.status,
      notes: input.data.notes ?? "",
      lastUpdated: timestamp,
      priceSource:
        input.data.manualCurrentPrice !== null
          ? "manual_sheet"
          : existingRecord?.priceSource ?? "",
      priceTon: existingRecord?.priceTon ?? "",
      totalTon: existingRecord?.totalTon ?? "",
    } satisfies CanonicalRecord;
  }

  return {
    id: existingRecord?.id ?? generateEntityId("crypto", input.data.symbol),
    symbol: input.data.symbol,
    name: input.data.name,
    quantity: input.data.quantity,
    entryPrice: input.data.entryPrice,
    currentPrice: input.data.manualCurrentPrice,
    priceSource:
      input.data.manualCurrentPrice !== null
        ? "manual_sheet"
        : existingRecord?.priceSource ?? "",
    walletNote: input.data.walletNote ?? "",
    status: input.data.status,
    notes: input.data.notes ?? "",
    lastUpdated: timestamp,
    currency: existingRecord?.currency ?? "USD",
  } satisfies CanonicalRecord;
}

function buildNextTransactionRecord(
  input: AdminTransactionMutationInput,
  timestamp: string,
) {
  return {
    id: generateTransactionId(input.data.assetType, input.data.assetName),
    date: input.data.date,
    assetType: input.data.assetType,
    assetName: input.data.assetName,
    action: input.data.action,
    quantity: input.data.quantity,
    price: input.data.price,
    fees: input.data.fees ?? (input.data.action === "fee" ? input.data.price ?? 0 : 0),
    currency: input.data.currency ?? "USD",
    notes: input.data.notes ?? `Создано через admin mode ${timestamp}`,
  } satisfies CanonicalRecord;
}

async function assertEditorAccess(fileId: string) {
  const auth = createGoogleAuth({ writeAccess: true });
  const drive = google.drive({ version: "v3", auth });
  const response = await drive.files.get({
    fileId,
    fields: "id,name,mimeType,capabilities(canEdit)",
  });

  return {
    canEdit: response.data.capabilities?.canEdit ?? false,
    fileName: response.data.name ?? null,
    mimeType: response.data.mimeType ?? null,
  };
}

function quoteSheetRange(sheetName: string, suffix: string) {
  return `'${sheetName.replace(/'/g, "''")}'!${suffix}`;
}

async function persistNativeWorkbook(
  document: SpreadsheetDocument,
  workbook: MutableWorkbook,
  touchedSheets: string[],
) {
  const auth = createGoogleAuth({ writeAccess: true });
  const sheets = google.sheets({ version: "v4", auth });

  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: document.fileId,
    fields: "sheets.properties.title",
  });

  const existingSheetNames = new Set(
    metadata.data.sheets
      ?.map((sheet) => sheet.properties?.title)
      .filter((sheetName): sheetName is string => Boolean(sheetName)) ?? [],
  );

  const missingSheets = touchedSheets.filter((sheetName) => !existingSheetNames.has(sheetName));

  if (missingSheets.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: document.fileId,
      requestBody: {
        requests: missingSheets.map((sheetName) => ({
          addSheet: {
            properties: {
              title: sheetName,
            },
          },
        })),
      },
    });
  }

  for (const sheetName of touchedSheets) {
    const values = workbook.sheets[sheetName] ?? [];

    await sheets.spreadsheets.values.clear({
      spreadsheetId: document.fileId,
      range: quoteSheetRange(sheetName, "A:ZZ"),
    });

    if (values.length === 0) {
      continue;
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: document.fileId,
      range: quoteSheetRange(sheetName, "A1"),
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values,
      },
    });
  }
}

async function persistDriveWorkbook(document: SpreadsheetDocument, workbook: MutableWorkbook) {
  const auth = createGoogleAuth({ writeAccess: true });
  const drive = google.drive({ version: "v3", auth });

  const nextWorkbook = XLSX.utils.book_new();
  nextWorkbook.Props = {
    Title: workbook.spreadsheetTitle ?? document.fileName ?? "Portfolio workbook",
  };

  for (const sheetName of workbook.availableSheets) {
    const values = workbook.sheets[sheetName] ?? [];
    const sheet = XLSX.utils.aoa_to_sheet(values);
    XLSX.utils.book_append_sheet(nextWorkbook, sheet, sheetName);
  }

  const buffer = XLSX.write(nextWorkbook, {
    bookType: "xlsx",
    type: "buffer",
  }) as Buffer;

  await drive.files.update({
    fileId: document.fileId,
    media: {
      mimeType:
        document.mimeType ?? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body: Readable.from(buffer),
    },
    fields: "id,name,mimeType,modifiedTime",
  });
}

async function persistWorkbook(
  document: SpreadsheetDocument,
  workbook: MutableWorkbook,
  touchedSheets: string[],
) {
  if (document.mode === "native_sheet") {
    await persistNativeWorkbook(document, workbook, touchedSheets);
    return;
  }

  await persistDriveWorkbook(document, workbook);
}

async function loadWritableDocument() {
  const document = await fetchSpreadsheetDocument({ writeAccess: true });
  const access = await assertEditorAccess(document.fileId);

  if (!access.canEdit) {
    throw new Error(
      "Service account имеет только Viewer-доступ к файлу. Выдай ему Editor-доступ перед сохранением изменений.",
    );
  }

  return document;
}

function invalidatePortfolioCaches() {
  forgetRemembered("portfolio-source");
  forgetRememberedByPrefix("coingecko:");
}

export async function getAdminWriteStatus(): Promise<AdminWriteStatus> {
  if (!isGoogleSheetsConfigured()) {
    return {
      enabled: false,
      canWrite: false,
      missingEditorAccess: false,
      mode: "unavailable",
      fileName: null,
      message: "Google Sheets credentials не настроены в env.",
    };
  }

  try {
    const document = await fetchSpreadsheetDocument({ writeAccess: true });
    const access = await assertEditorAccess(document.fileId);

    return {
      enabled: true,
      canWrite: access.canEdit,
      missingEditorAccess: !access.canEdit,
      mode: document.mode,
      fileName: access.fileName ?? document.fileName ?? null,
      message: access.canEdit
        ? null
        : "Service account имеет только Viewer-доступ к файлу. Выдай ему роль Editor, иначе dashboard останется read-only.",
    };
  } catch (error) {
    return {
      enabled: false,
      canWrite: false,
      missingEditorAccess: false,
      mode: "unavailable",
      fileName: null,
      message: `Admin mode недоступен: ${toEditorAccessMessage(error)}`,
    };
  }
}

export async function applyAdminMutation(input: AdminMutationInput): Promise<AdminMutationResult> {
  adminEntityTypeSchema.parse(input.entityType);

  const document = await loadWritableDocument();
  const workbook = cloneWorkbook(document.workbook);
  const timestamp = new Date().toISOString();
  const canonicalSheet = ENTITY_SHEET_MAP[input.entityType];
  const targetSheetName =
    input.operation === "update" ? input.rowRef.sheetName : getEntitySheetName(workbook, input.entityType);

  const { values, headerMap } = getCanonicalHeaderMap(workbook, targetSheetName, canonicalSheet);
  const rowNumber = input.operation === "update" ? input.rowRef.rowNumber : values.length + 1;
  const beforeRecord =
    input.operation === "update"
      ? buildCanonicalRecord(values, input.rowRef.rowNumber, canonicalSheet)
      : null;
  const nextRecord = buildNextPositionRecord(input, beforeRecord, timestamp);

  setRecordValues(values, rowNumber, headerMap, nextRecord);
  appendAuditLog(workbook, {
    action: input.operation === "create" ? "create_position" : "update_position",
    entityType: input.entityType,
    entityId: String(nextRecord.id),
    before: beforeRecord,
    after: nextRecord,
    notes:
      input.operation === "create"
        ? "Создание позиции через admin mode"
        : `Обновление позиции через admin mode (${targetSheetName}:${rowNumber})`,
  });

  const touchedSheets = [
    targetSheetName,
    findMatchedSheetName(workbook.availableSheets, "Audit_Log") ?? "Audit_Log",
  ];

  await persistWorkbook(document, workbook, touchedSheets);
  invalidatePortfolioCaches();

  return {
    entityId: String(nextRecord.id),
    entityType: input.entityType,
    operation: input.operation,
    sheetName: targetSheetName,
    rowNumber,
  };
}

export async function applyTransactionMutation(
  input: AdminTransactionMutationInput,
): Promise<AdminMutationResult> {
  const document = await loadWritableDocument();
  const workbook = cloneWorkbook(document.workbook);
  const timestamp = new Date().toISOString();
  const sheetName = getTransactionsSheetName(workbook);
  const { values, headerMap } = getCanonicalHeaderMap(workbook, sheetName, "Transactions");
  const rowNumber = values.length + 1;
  const nextRecord = buildNextTransactionRecord(input, timestamp);

  setRecordValues(values, rowNumber, headerMap, nextRecord);
  appendAuditLog(workbook, {
    action: "create_transaction",
    entityType: "transaction",
    entityId: String(nextRecord.id),
    before: null,
    after: nextRecord,
    notes: `Создание транзакции через admin mode (${sheetName}:${rowNumber})`,
  });

  const touchedSheets = [
    sheetName,
    findMatchedSheetName(workbook.availableSheets, "Audit_Log") ?? "Audit_Log",
  ];

  await persistWorkbook(document, workbook, touchedSheets);
  invalidatePortfolioCaches();

  return {
    entityId: String(nextRecord.id),
    entityType: "transaction",
    operation: "create",
    sheetName,
    rowNumber,
  };
}
