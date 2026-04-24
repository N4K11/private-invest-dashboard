import { google } from "googleapis";
import * as XLSX from "xlsx";

const requiredTabs = {
  Summary: ["metric", "value"],
  CS2_Positions: [
    "name",
    "type",
    "quantity",
    "average_entry_price",
    "current_price",
    "notes",
  ],
  Telegram_Gifts: ["name", "quantity", "estimated_price", "notes"],
  Crypto: [
    "symbol",
    "name",
    "quantity",
    "average_entry_price",
    "current_price",
    "notes",
  ],
  Transactions: ["date", "category", "asset", "quantity", "price", "notes"],
  Settings: ["key", "value"],
};

function normalizeSpreadsheetId(value) {
  if (!value) {
    return "";
  }

  const match = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? value.trim();
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
        range: `${tab}!1:2`,
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
      workbook.SheetNames.map((tab) => [tab, toSheetValues(workbook.Sheets[tab]).slice(0, 2)]),
    );

    console.log("Detected a Drive-hosted workbook. Using download fallback.");
    console.log("");
  }

  console.log(`Spreadsheet: ${title}`);
  console.log(`Available tabs: ${availableTabs.join(", ")}`);
  console.log("");

  for (const [tab, headers] of Object.entries(requiredTabs)) {
    const exists = availableTabs.includes(tab);
    if (!exists) {
      console.log(`[missing] ${tab}`);
      console.log(`  expected headers: ${headers.join(", ")}`);
      continue;
    }

    const currentHeaders = valuesByTab[tab]?.[0] ?? [];
    console.log(`[ok] ${tab}`);
    console.log(`  current headers: ${currentHeaders.join(", ") || "<empty>"}`);
    console.log(`  expected headers: ${headers.join(", ")}`);
  }
}

main().catch((error) => {
  console.error(`Validation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
