import { google } from "googleapis";
import * as XLSX from "xlsx";
import sheetSchema from "../src/lib/sheets/schema.json" with { type: "json" };

const runtimeAssetTabs = ["CS2_Positions", "Telegram_Gifts", "Crypto"];

function normalizeSpreadsheetId(value) {
  if (!value) {
    return "";
  }

  const match = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? value.trim();
}

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
}

function getCredentials() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    return {
      email: parsed.client_email,
      key: parsed.private_key?.replace(/\\n/g, "\n"),
    };
  }

  return {
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  };
}

function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isUnsupportedSheetDocumentError(error) {
  return /not supported for this document/i.test(getErrorMessage(error));
}

function toSheetValues(sheet) {
  if (!sheet) {
    return [];
  }

  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });
}

function findMatchedTab(availableTabs, logicalTab) {
  const config = sheetSchema.tabs[logicalTab];
  return config.aliases.find((alias) => availableTabs.includes(alias)) ?? null;
}

function getHeaderKeys(values) {
  return (values?.[0] ?? [])
    .map((value) => normalizeHeader(value))
    .filter(Boolean);
}

function getMissingRequiredFields(logicalTab, values) {
  const presentHeaders = new Set(getHeaderKeys(values));

  return sheetSchema.tabs[logicalTab].fields
    .filter((field) => field.required)
    .filter(
      (field) =>
        !field.aliases.some((alias) => presentHeaders.has(normalizeHeader(alias))),
    )
    .map((field) => field.key);
}

async function main() {
  const spreadsheetId = normalizeSpreadsheetId(
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
  );

  if (!spreadsheetId) {
    throw new Error("Missing GOOGLE_SHEETS_SPREADSHEET_ID");
  }

  const credentials = getCredentials();
  if (!credentials.email || !credentials.key) {
    throw new Error(
      "Missing service-account credentials. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY or GOOGLE_SERVICE_ACCOUNT_JSON.",
    );
  }

  const auth = new google.auth.JWT({
    email: credentials.email,
    key: credentials.key,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets.readonly",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });

  const sheets = google.sheets({ version: "v4", auth });

  let title = spreadsheetId;
  let availableTabs = [];
  let valuesByTab = {};
  let sourceMode = "native_sheets";

  try {
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "properties.title,sheets.properties.title",
    });

    title = metadata.data.properties?.title ?? spreadsheetId;
    availableTabs =
      metadata.data.sheets
        ?.map((sheet) => sheet.properties?.title)
        .filter(Boolean) ?? [];

    for (const tab of availableTabs) {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${tab}!1:3`,
      });

      valuesByTab[tab] = response.data.values ?? [];
    }
  } catch (error) {
    if (!isUnsupportedSheetDocumentError(error)) {
      throw error;
    }

    const drive = google.drive({ version: "v3", auth });
    const metadata = await drive.files.get({
      fileId: spreadsheetId,
      fields: "id,name,mimeType",
    });
    const fileResponse = await drive.files.get(
      {
        fileId: spreadsheetId,
        alt: "media",
      },
      {
        responseType: "arraybuffer",
      },
    );
    const workbook = XLSX.read(Buffer.from(fileResponse.data), { type: "buffer" });

    title = workbook.Props?.Title ?? metadata.data.name ?? spreadsheetId;
    availableTabs = workbook.SheetNames;
    valuesByTab = Object.fromEntries(
      workbook.SheetNames.map((tab) => [tab, toSheetValues(workbook.Sheets[tab]).slice(0, 3)]),
    );
    sourceMode = "drive_workbook_fallback";
  }

  console.log(`Spreadsheet: ${title}`);
  console.log(`Source mode: ${sourceMode}`);
  console.log(`Available tabs: ${availableTabs.join(", ")}`);
  console.log("");

  let canonicalMissing = 0;
  let canonicalColumnGaps = 0;

  for (const logicalTab of Object.keys(sheetSchema.tabs)) {
    const config = sheetSchema.tabs[logicalTab];
    const matchedTab = findMatchedTab(availableTabs, logicalTab);

    if (!matchedTab) {
      canonicalMissing += 1;
      console.log(`[missing canonical] ${logicalTab}`);
      console.log(`  accepted sheet names: ${config.aliases.join(", ")}`);
      console.log(
        `  required columns: ${config.fields.filter((field) => field.required).map((field) => field.key).join(", ")}`,
      );
      continue;
    }

    const values = valuesByTab[matchedTab] ?? [];
    const headerKeys = getHeaderKeys(values);
    const missingFields = matchedTab === logicalTab ? getMissingRequiredFields(logicalTab, values) : [];

    if (matchedTab !== logicalTab) {
      console.log(`[legacy alias] ${logicalTab} -> ${matchedTab}`);
      console.log(`  current headers: ${headerKeys.join(", ") || "<empty>"}`);
      console.log(
        `  canonical columns still recommended: ${config.fields.filter((field) => field.required).map((field) => field.key).join(", ")}`,
      );
      continue;
    }

    if (missingFields.length > 0) {
      canonicalColumnGaps += 1;
      console.log(`[needs columns] ${logicalTab}`);
      console.log(`  current headers: ${headerKeys.join(", ") || "<empty>"}`);
      console.log(`  missing required columns: ${missingFields.join(", ")}`);
      continue;
    }

    console.log(`[ok] ${logicalTab}`);
    console.log(`  current headers: ${headerKeys.join(", ") || "<empty>"}`);
  }

  console.log("");

  const hasSummary = Boolean(findMatchedTab(availableTabs, "Summary"));
  const hasAnyRuntimeAssetSheet = runtimeAssetTabs.some((tab) => findMatchedTab(availableTabs, tab));
  const runtimeCompatible = hasSummary && hasAnyRuntimeAssetSheet;
  const canonicalReady = canonicalMissing === 0 && canonicalColumnGaps === 0;

  console.log(`Runtime compatibility: ${runtimeCompatible ? "OK" : "FAIL"}`);
  console.log(`Canonical structure ready: ${canonicalReady ? "YES" : "NO"}`);

  if (!runtimeCompatible) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Validation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
