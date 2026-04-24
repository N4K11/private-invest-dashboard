import { google } from "googleapis";
import * as XLSX from "xlsx";

import { getEnv } from "@/lib/env";

import type { RawSpreadsheetWorkbook, SheetCellValue } from "./normalizers";

const GOOGLE_READONLY_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
];

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

function createGoogleAuth() {
  const credentials = getGoogleCredentials();

  return new google.auth.JWT({
    email: credentials.email,
    key: credentials.key,
    scopes: [...GOOGLE_READONLY_SCOPES],
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isUnsupportedSheetDocumentError(error: unknown) {
  return /not supported for this document/i.test(getErrorMessage(error));
}

function getWorkbookSheetValues(sheet?: XLSX.WorkSheet) {
  if (!sheet) {
    return [] as SheetCellValue[][];
  }

  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  }) as SheetCellValue[][];
}

async function fetchNativeSpreadsheetWorkbook(
  spreadsheetId: string,
  auth: InstanceType<typeof google.auth.JWT>,
): Promise<RawSpreadsheetWorkbook> {
  const sheets = google.sheets({ version: "v4", auth });

  const metadataResponse = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "properties.title,sheets.properties.title",
  });

  const availableSheets =
    metadataResponse.data.sheets
      ?.map((sheet) => sheet.properties?.title)
      .filter((title): title is string => Boolean(title)) ?? [];

  const ranges = availableSheets.map((sheetName) => `${sheetName}!A:Z`);

  const valuesResponse = ranges.length
    ? await sheets.spreadsheets.values.batchGet({
        spreadsheetId,
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

async function fetchDriveWorkbook(
  fileId: string,
  auth: InstanceType<typeof google.auth.JWT>,
): Promise<RawSpreadsheetWorkbook> {
  const drive = google.drive({ version: "v3", auth });

  const metadataResponse = await drive.files.get({
    fileId,
    fields: "id,name,mimeType",
  });

  const fileResponse = await drive.files.get(
    {
      fileId,
      alt: "media",
    },
    {
      responseType: "arraybuffer",
    },
  );

  const workbook = XLSX.read(Buffer.from(fileResponse.data as ArrayBuffer), {
    type: "buffer",
  });

  const availableSheets = workbook.SheetNames;
  const workbookSheets = availableSheets.reduce<Record<string, SheetCellValue[][]>>(
    (collection, sheetName) => {
      collection[sheetName] = getWorkbookSheetValues(workbook.Sheets[sheetName]);
      return collection;
    },
    {},
  );

  return {
    spreadsheetTitle:
      workbook.Props?.Title ??
      metadataResponse.data.name ??
      metadataResponse.data.id ??
      undefined,
    availableSheets,
    sheets: workbookSheets,
  };
}

export async function fetchSpreadsheetWorkbook(): Promise<RawSpreadsheetWorkbook> {
  const env = getEnv();
  const spreadsheetId = env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error("Missing GOOGLE_SHEETS_SPREADSHEET_ID");
  }

  const auth = createGoogleAuth();

  try {
    return await fetchNativeSpreadsheetWorkbook(spreadsheetId, auth);
  } catch (error) {
    if (!isUnsupportedSheetDocumentError(error)) {
      throw error;
    }

    try {
      return await fetchDriveWorkbook(spreadsheetId, auth);
    } catch (driveError) {
      throw new Error(
        `Google Sheets API не может прочитать этот документ напрямую. Drive fallback завершился ошибкой: ${getErrorMessage(driveError)}. Если файл был загружен из Excel, включи Google Drive API и выдай доступ service account.`,
      );
    }
  }
}

