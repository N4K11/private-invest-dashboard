import { z } from "zod";

export const importSourceEnum = z.enum([
  "google_sheets",
  "csv",
  "json",
  "steam_export",
  "manual_template",
]);

const mappingSchema = z.object({
  category: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  symbol: z.string().trim().min(1).optional(),
  quantity: z.string().trim().min(1).optional(),
  averageEntryPrice: z.string().trim().min(1).optional(),
  currentPrice: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
  externalId: z.string().trim().min(1).optional(),
  externalSource: z.string().trim().min(1).optional(),
  collection: z.string().trim().min(1).optional(),
});

export const importPreviewRequestSchema = z
  .object({
    portfolioId: z.string().trim().min(1, "Не выбран портфель для импорта."),
    sourceType: importSourceEnum,
    spreadsheetIdOrUrl: z.string().trim().optional(),
    content: z.string().optional(),
    fileName: z.string().trim().optional(),
    mapping: mappingSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.sourceType === "google_sheets") {
      if (!value.spreadsheetIdOrUrl?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["spreadsheetIdOrUrl"],
          message: "Укажите Google Sheets URL или spreadsheet ID.",
        });
      }

      return;
    }

    if (!value.content?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content"],
        message: "Передайте содержимое файла или вставьте данные для preview.",
      });
    }
  });

export const importPreviewRecordSchema = z.object({
  id: z.string().trim().min(1),
  dedupeKey: z.string().trim().min(1),
  category: z.enum(["cs2", "telegram", "crypto", "custom", "nft"]),
  name: z.string().trim().min(1),
  symbol: z.string().trim().nullable(),
  quantity: z.number().finite().nonnegative(),
  averageEntryPrice: z.number().finite().nullable(),
  currentPrice: z.number().finite().nullable(),
  notes: z.string().nullable(),
  externalId: z.string().nullable(),
  externalSource: z.string().nullable(),
  collection: z.string().nullable(),
  warnings: z.array(z.string()),
  sourceRowIds: z.array(z.string().trim().min(1)).min(1),
  raw: z.record(z.string(), z.string()),
});

export const importCommitRequestSchema = z.object({
  portfolioId: z.string().trim().min(1, "Не выбран портфель для импорта."),
  sourceType: importSourceEnum,
  sourceLabel: z.string().trim().min(1),
  sourceSummary: z.string().trim().min(1),
  duplicateRowCount: z.number().int().nonnegative().default(0),
  totalSourceRows: z.number().int().nonnegative().default(0),
  records: z.array(importPreviewRecordSchema).min(1, "Нет импортируемых записей."),
});

export type ImportPreviewRequest = z.infer<typeof importPreviewRequestSchema>;
export type ImportCommitRequest = z.infer<typeof importCommitRequestSchema>;
