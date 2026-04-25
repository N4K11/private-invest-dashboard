import {
  CANONICAL_SHEET_NAMES,
  findMatchedSheetName,
  getMissingRequiredFields,
  getRequiredFieldKeys,
  getSheetHeaderKeys,
  getSheetSchema,
} from "@/lib/sheets/schema";
import type { SpreadsheetDocument } from "@/lib/sheets/client";
import type { SheetValidationIssue, SheetValidationReport } from "@/types/health";

const RUNTIME_ASSET_TABS = ["CS2_Positions", "Telegram_Gifts", "Crypto"] as const;

export function validateSpreadsheetDocument(
  document: Pick<SpreadsheetDocument, "mode" | "fileName" | "workbook">,
): SheetValidationReport {
  const availableTabs = document.workbook.availableSheets;
  const issues: SheetValidationIssue[] = [];

  for (const logicalTab of CANONICAL_SHEET_NAMES) {
    const schema = getSheetSchema(logicalTab);
    const matchedTab = findMatchedSheetName(availableTabs, logicalTab);
    const requiredFields = getRequiredFieldKeys(logicalTab);

    if (!matchedTab) {
      issues.push({
        kind: "missing_canonical",
        logicalTab,
        matchedTab: null,
        acceptedAliases: [...schema.aliases],
        requiredFields,
        headers: [],
        missingFields: requiredFields,
      });
      continue;
    }

    const headers = getSheetHeaderKeys(document.workbook.sheets[matchedTab]);

    if (matchedTab !== logicalTab) {
      issues.push({
        kind: "legacy_alias",
        logicalTab,
        matchedTab,
        acceptedAliases: [...schema.aliases],
        requiredFields,
        headers,
        missingFields: [],
      });
      continue;
    }

    const missingFields = getMissingRequiredFields(logicalTab, document.workbook.sheets[matchedTab]);
    issues.push({
      kind: missingFields.length > 0 ? "needs_columns" : "ok",
      logicalTab,
      matchedTab,
      acceptedAliases: [...schema.aliases],
      requiredFields,
      headers,
      missingFields,
    });
  }

  const runtimeCompatible =
    Boolean(findMatchedSheetName(availableTabs, "Summary")) &&
    RUNTIME_ASSET_TABS.some((tab) => Boolean(findMatchedSheetName(availableTabs, tab)));
  const canonicalReady = !issues.some(
    (issue) => issue.kind === "missing_canonical" || issue.kind === "needs_columns",
  );

  return {
    spreadsheetTitle:
      document.workbook.spreadsheetTitle ?? document.fileName ?? "Google Sheets document",
    sourceMode: document.mode,
    availableTabs: [...availableTabs],
    runtimeCompatible,
    canonicalReady,
    issues,
  };
}
