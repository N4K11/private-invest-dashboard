import { google } from "googleapis";

import { getEnv } from "@/lib/env";

import type { RawSpreadsheetWorkbook, SheetCellValue } from "./normalizers";

function getGoogleCredentials() {
  const env = getEnv();

  if (env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const parsed = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON) as {
      client_email?: string;
      private_key?: string;
    };

    return {
      email: parsed.client_email ?? "",
      key: parsed.private_key?.replace(/\\n/g, "\n") ?? "",
    };
  }

  return {
    email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "",
    key: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n") ?? "",
  };
}

export async function fetchSpreadsheetWorkbook(): Promise<RawSpreadsheetWorkbook> {
  const env = getEnv();
  const credentials = getGoogleCredentials();

  const auth = new google.auth.JWT({
    email: credentials.email,
    key: credentials.key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  const metadataResponse = await sheets.spreadsheets.get({
    spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
    fields: "properties.title,sheets.properties.title",
  });

  const availableSheets =
    metadataResponse.data.sheets
      ?.map((sheet) => sheet.properties?.title)
      .filter((title): title is string => Boolean(title)) ?? [];

  const ranges = availableSheets.map((sheetName) => `${sheetName}!A:Z`);

  const valuesResponse = ranges.length
    ? await sheets.spreadsheets.values.batchGet({
        spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
        ranges,
        valueRenderOption: "UNFORMATTED_VALUE",
      })
    : { data: { valueRanges: [] } };

  const workbookSheets = (valuesResponse.data.valueRanges ?? []).reduce<
    Record<string, SheetCellValue[][]>
  >((collection, range) => {
    const sheetName = range.range?.split("!")[0] ?? "Unknown";
    collection[sheetName] = (range.values as SheetCellValue[][] | undefined) ?? [];
    return collection;
  }, {});

  return {
    spreadsheetTitle: metadataResponse.data.properties?.title ?? undefined,
    availableSheets,
    sheets: workbookSheets,
  };
}
