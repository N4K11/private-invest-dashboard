import { google } from "googleapis";
import * as XLSX from "xlsx";

import { getEnv } from "@/lib/env";

import type { RawSpreadsheetWorkbook, SheetCellValue } from "./normalizers";

const GOOGLE_READONLY_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
];

const GOOGLE_WRITE_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
];

export type SpreadsheetDocumentMode = "native_sheet" | "drive_workbook";

export interface SpreadsheetDocument {
  fileId: string;
  mode: SpreadsheetDocumentMode;
  workbook: RawSpreadsheetWorkbook;
  fileName?: string;
  mimeType?: string;
}

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

export function createGoogleAuth(options?: { writeAccess?: boolean }) {
  const credentials = getGoogleCredentials();

  return new google.auth.JWT({
    email: credentials.email,
    key: credentials.key,
    scopes: options?.writeAccess ? [...GOOGLE_WRITE_SCOPES] : [...GOOGLE_READONLY_SCOPES],
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

async function fetchNativeSpreadsheetDocument(
  spreadsheetId: string,
  auth: InstanceType<typeof google.auth.JWT>,
): Promise<SpreadsheetDocument> {
  const sheets = google.sheets({ version: "v4", auth });

  const metadataResponse = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "properties.title,sheets.properties.title",
  });

  const availableSheets =
    metadataResponse.data.sheets
      ?.map((sheet) => sheet.properties?.title)
      .filter((title): title is string => Boolean(title)) ?? [];

  const ranges = availableSheets.map((sheetName) => `${sheetName}!A:ZZ`);

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
    fileId: spreadsheetId,
    mode: "native_sheet",
    fileName: metadataResponse.data.properties?.title ?? undefined,
    mimeType: "application/vnd.google-apps.spreadsheet",
    workbook: {
      spreadsheetTitle: metadataResponse.data.properties?.title ?? undefined,
      availableSheets,
      sheets: workbookSheets,
    },
  };
}

async function fetchDriveSpreadsheetDocument(
  fileId: string,
  auth: InstanceType<typeof google.auth.JWT>,
): Promise<SpreadsheetDocument> {
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
    fileId,
    mode: "drive_workbook",
    fileName: metadataResponse.data.name ?? metadataResponse.data.id ?? undefined,
    mimeType:
      metadataResponse.data.mimeType ??
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    workbook: {
      spreadsheetTitle:
        workbook.Props?.Title ?? metadataResponse.data.name ?? metadataResponse.data.id ?? undefined,
      availableSheets,
      sheets: workbookSheets,
    },
  };
}

export async function fetchSpreadsheetDocument(options?: { writeAccess?: boolean }) {
  const env = getEnv();
  const spreadsheetId = env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error("Missing GOOGLE_SHEETS_SPREADSHEET_ID");
  }

  const auth = createGoogleAuth({ writeAccess: options?.writeAccess });

  try {
    return await fetchNativeSpreadsheetDocument(spreadsheetId, auth);
  } catch (error) {
    if (!isUnsupportedSheetDocumentError(error)) {
      throw error;
    }

    try {
      return await fetchDriveSpreadsheetDocument(spreadsheetId, auth);
    } catch (driveError) {
      throw new Error(
        `Google Sheets API не может прочитать этот документ напрямую. Drive fallback завершился ошибкой: ${getErrorMessage(driveError)}. Если файл был загружен из Excel, включи Google Drive API и выдай доступ service account.`,
      );
    }
  }
}

export async function fetchSpreadsheetWorkbook(): Promise<RawSpreadsheetWorkbook> {
  const document = await fetchSpreadsheetDocument();
  return document.workbook;
}
