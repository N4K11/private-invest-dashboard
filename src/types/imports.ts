export type ImportSourceType =
  | "google_sheets"
  | "csv"
  | "json"
  | "steam_export"
  | "manual_template";

export type ImportAssetCategory = "cs2" | "telegram" | "crypto" | "custom" | "nft";

export type ImportFieldKey =
  | "category"
  | "name"
  | "symbol"
  | "quantity"
  | "averageEntryPrice"
  | "currentPrice"
  | "notes"
  | "externalId"
  | "externalSource"
  | "collection";

export type ImportColumnMapping = Partial<Record<ImportFieldKey, string>>;

export type ImportPreviewRecord = {
  id: string;
  dedupeKey: string;
  category: ImportAssetCategory;
  name: string;
  symbol: string | null;
  quantity: number;
  averageEntryPrice: number | null;
  currentPrice: number | null;
  notes: string | null;
  externalId: string | null;
  externalSource: string | null;
  collection: string | null;
  warnings: string[];
  sourceRowIds: string[];
  raw: Record<string, string>;
};

export type ImportPreviewCategoryCount = {
  category: ImportAssetCategory;
  label: string;
  count: number;
};

export type ImportPreview = {
  sourceType: ImportSourceType;
  sourceLabel: string;
  sourceSummary: string;
  mappingEditable: boolean;
  availableColumns: string[];
  suggestedMapping: ImportColumnMapping;
  warnings: string[];
  duplicateRowCount: number;
  totalSourceRows: number;
  importableRowCount: number;
  deduplicatedRecordCount: number;
  byCategory: ImportPreviewCategoryCount[];
  records: ImportPreviewRecord[];
  sampleRows: Record<string, string>[];
};

export type ImportCommitResult = {
  importedRecordCount: number;
  createdAssetCount: number;
  updatedAssetCount: number;
  createdPositionCount: number;
  updatedPositionCount: number;
  auditLogId: string;
  sourceType: ImportSourceType;
  sourceLabel: string;
};
