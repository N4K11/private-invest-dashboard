import schemaJson from "@/lib/sheets/schema.json";

export type CanonicalSheetName = keyof typeof schemaJson.tabs;

type SheetSchemaField = {
  key: string;
  required: boolean;
  aliases: string[];
};

type SheetSchemaTab = {
  aliases: string[];
  requiredForCanonical: boolean;
  fields: SheetSchemaField[];
};

export type WorkbookLike<TValue = unknown> = {
  availableSheets: string[];
  sheets: Record<string, TValue>;
};

export const SHEET_SCHEMA = schemaJson.tabs as Record<CanonicalSheetName, SheetSchemaTab>;
export const CANONICAL_SHEET_NAMES = Object.keys(SHEET_SCHEMA) as CanonicalSheetName[];

export function normalizeSheetHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
}

export function getSheetSchema(sheetName: CanonicalSheetName) {
  return SHEET_SCHEMA[sheetName];
}

export function getFieldAliases(sheetName: CanonicalSheetName, fieldKey: string) {
  const field = SHEET_SCHEMA[sheetName].fields.find((entry) => entry.key === fieldKey);
  return field?.aliases ?? [fieldKey];
}

export function getRequiredFieldKeys(sheetName: CanonicalSheetName) {
  return SHEET_SCHEMA[sheetName].fields
    .filter((field) => field.required)
    .map((field) => field.key);
}

export function findMatchedSheetName(
  availableSheets: string[],
  sheetName: CanonicalSheetName,
) {
  return SHEET_SCHEMA[sheetName].aliases.find((alias) => availableSheets.includes(alias)) ?? null;
}

export function getWorkbookSheet<TValue>(
  workbook: WorkbookLike<TValue>,
  sheetName: CanonicalSheetName,
) {
  const matchedName = findMatchedSheetName(workbook.availableSheets, sheetName);

  return {
    matchedName,
    isCanonical: matchedName === sheetName,
    values: matchedName ? workbook.sheets[matchedName] : undefined,
  };
}

export function getSheetHeaderKeys(values?: unknown[][]) {
  return (values?.[0] ?? [])
    .map((value) => normalizeSheetHeader(value))
    .filter((value) => value.length > 0);
}

export function getMissingRequiredFields(
  sheetName: CanonicalSheetName,
  values?: unknown[][],
) {
  const presentHeaders = new Set(getSheetHeaderKeys(values));

  return SHEET_SCHEMA[sheetName].fields
    .filter((field) => field.required)
    .filter(
      (field) =>
        !field.aliases.some((alias) => presentHeaders.has(normalizeSheetHeader(alias))),
    )
    .map((field) => field.key);
}
