import { remember } from "@/lib/cache/ttl-store";
import { createDemoWorkbook } from "@/lib/data/demo-portfolio";
import { getEnv, isGoogleSheetsConfigured } from "@/lib/env";
import type { DataSourceMode } from "@/types/portfolio";

import { fetchSpreadsheetWorkbook } from "./client";
import { normalizeWorkbook, type NormalizedWorkbook } from "./normalizers";

export interface PortfolioSource {
  workbook: NormalizedWorkbook;
  sourceMode: DataSourceMode;
  sourceLabel: string;
  warnings: string[];
  lastUpdatedAt: string;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown Google Sheets error";
}

export async function getPortfolioSource(): Promise<PortfolioSource> {
  const env = getEnv();

  return remember("portfolio-source", env.PORTFOLIO_CACHE_TTL_SECONDS * 1000, async () => {
    if (!isGoogleSheetsConfigured()) {
      const workbook = createDemoWorkbook();
      return {
        workbook,
        sourceMode: "demo" as const,
        sourceLabel: "Demo dataset",
        warnings: workbook.warnings,
        lastUpdatedAt: new Date().toISOString(),
      };
    }

    try {
      const workbook = normalizeWorkbook(await fetchSpreadsheetWorkbook());
      return {
        workbook,
        sourceMode: "live" as const,
        sourceLabel: "Google Sheets + live market data",
        warnings: workbook.warnings,
        lastUpdatedAt: new Date().toISOString(),
      };
    } catch (error) {
      const workbook = createDemoWorkbook({ warnings: [] });
      return {
        workbook,
        sourceMode: "fallback" as const,
        sourceLabel: "Fallback demo dataset",
        warnings: [`Google Sheets read failed: ${getErrorMessage(error)}`],
        lastUpdatedAt: new Date().toISOString(),
      };
    }
  });
}
