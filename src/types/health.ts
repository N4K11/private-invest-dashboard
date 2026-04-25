import type { DataSourceMode } from "@/types/portfolio";

export type HealthTone = "ok" | "warning" | "error" | "info";
export type HealthActionType =
  | "refresh_cache"
  | "validate_google_sheet"
  | "create_snapshot"
  | "test_price_providers";

export interface AdminWriteStatusView {
  enabled: boolean;
  canWrite: boolean;
  missingEditorAccess: boolean;
  mode: "native_sheet" | "drive_workbook" | "unavailable";
  fileName: string | null;
  message: string | null;
}

export interface HealthIndicator {
  id: string;
  label: string;
  tone: HealthTone;
  summary: string;
  details: string[];
}

export interface CacheHealthSnapshot {
  tone: HealthTone;
  summary: string;
  driver: "memory" | "redis_rest";
  remoteEnabled: boolean;
  remoteHealthy: boolean | null;
  remoteSummary: string;
  totalEntries: number;
  priceEntries: number;
  sourceEntries: number;
  inFlightEntries: number;
  portfolioSourceCached: boolean;
}

export interface SheetValidationIssue {
  kind: "ok" | "missing_canonical" | "legacy_alias" | "needs_columns";
  logicalTab: string;
  matchedTab: string | null;
  acceptedAliases: string[];
  requiredFields: string[];
  headers: string[];
  missingFields: string[];
}

export interface SheetValidationReport {
  spreadsheetTitle: string;
  sourceMode: "native_sheet" | "drive_workbook";
  availableTabs: string[];
  runtimeCompatible: boolean;
  canonicalReady: boolean;
  issues: SheetValidationIssue[];
}

export interface PriceProviderDiagnosticResult {
  provider: "crypto" | "cs2" | "telegram";
  tone: HealthTone;
  summary: string;
  details: string[];
}

export interface DashboardHealthSnapshot {
  generatedAt: string;
  sourceMode: DataSourceMode;
  dashboardConfigured: boolean;
  tokenGateActive: boolean;
  documentTitle: string | null;
  documentMode: "native_sheet" | "drive_workbook" | "unavailable";
  availableSheets: string[];
  lastPortfolioRefresh: string | null;
  lastSnapshotDate: string | null;
  statuses: HealthIndicator[];
  providers: HealthIndicator[];
  cache: CacheHealthSnapshot;
  validation: SheetValidationReport | null;
  warnings: string[];
  admin: AdminWriteStatusView;
}

export interface DashboardHealthActionResponse {
  ok: boolean;
  action: HealthActionType;
  message: string;
  health: DashboardHealthSnapshot;
  validation?: SheetValidationReport;
  diagnostics?: PriceProviderDiagnosticResult[];
  cacheBefore?: CacheHealthSnapshot;
  cacheAfter?: CacheHealthSnapshot;
  snapshotResult?: {
    operation: "create" | "update";
    date: string;
  };
}
