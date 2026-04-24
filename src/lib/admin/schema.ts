import { z } from "zod";

const emptyToNull = (value: unknown) => {
  if (value === undefined || value === "") {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return value;
};

const nullableMoneySchema = z.preprocess(
  emptyToNull,
  z.union([z.coerce.number().finite().min(0), z.null()]),
);

const nullableShortTextSchema = z.preprocess(
  emptyToNull,
  z.union([z.string().trim().max(160), z.null()]),
);

const nullableLongTextSchema = z.preprocess(
  emptyToNull,
  z.union([z.string().trim().max(2000), z.null()]),
);

const requiredTextSchema = z.string().trim().min(1).max(200);
const quantitySchema = z.coerce.number().finite().min(0);
const statusSchema = z.string().trim().min(1).max(40).transform((value) => value.toLowerCase());

export const adminEntityTypeSchema = z.enum(["cs2", "telegram", "crypto"]);
export type AdminEntityType = z.infer<typeof adminEntityTypeSchema>;

export const adminRowRefSchema = z.object({
  sheetName: z.string().trim().min(1).max(160),
  rowNumber: z.coerce.number().int().min(2).max(100000),
  isCanonical: z.boolean(),
});

export const cs2AdminDataSchema = z.object({
  name: requiredTextSchema,
  assetType: z.enum(["stickers", "skins", "cases", "charms", "graffiti", "other"]),
  category: nullableShortTextSchema,
  quantity: quantitySchema,
  entryPrice: nullableMoneySchema,
  manualCurrentPrice: nullableMoneySchema,
  status: statusSchema,
  notes: nullableLongTextSchema,
});

export const telegramAdminDataSchema = z.object({
  name: requiredTextSchema,
  collection: nullableShortTextSchema,
  quantity: quantitySchema,
  entryPrice: nullableMoneySchema,
  manualCurrentPrice: nullableMoneySchema,
  priceConfidence: z.preprocess(
    emptyToNull,
    z.union([z.enum(["low", "medium", "high"]), z.null()]),
  ),
  liquidityNote: nullableShortTextSchema,
  status: statusSchema,
  notes: nullableLongTextSchema,
});

export const cryptoAdminDataSchema = z.object({
  symbol: z.string().trim().min(1).max(20).transform((value) => value.toUpperCase()),
  name: requiredTextSchema,
  quantity: quantitySchema,
  entryPrice: nullableMoneySchema,
  manualCurrentPrice: nullableMoneySchema,
  walletNote: nullableShortTextSchema,
  status: statusSchema,
  notes: nullableLongTextSchema,
});

export const adminMutationSchema = z.discriminatedUnion("operation", [
  z.discriminatedUnion("entityType", [
    z.object({
      operation: z.literal("create"),
      entityType: z.literal("cs2"),
      data: cs2AdminDataSchema,
    }),
    z.object({
      operation: z.literal("create"),
      entityType: z.literal("telegram"),
      data: telegramAdminDataSchema,
    }),
    z.object({
      operation: z.literal("create"),
      entityType: z.literal("crypto"),
      data: cryptoAdminDataSchema,
    }),
  ]),
  z.discriminatedUnion("entityType", [
    z.object({
      operation: z.literal("update"),
      entityType: z.literal("cs2"),
      id: z.string().trim().min(1).max(240),
      rowRef: adminRowRefSchema,
      data: cs2AdminDataSchema,
    }),
    z.object({
      operation: z.literal("update"),
      entityType: z.literal("telegram"),
      id: z.string().trim().min(1).max(240),
      rowRef: adminRowRefSchema,
      data: telegramAdminDataSchema,
    }),
    z.object({
      operation: z.literal("update"),
      entityType: z.literal("crypto"),
      id: z.string().trim().min(1).max(240),
      rowRef: adminRowRefSchema,
      data: cryptoAdminDataSchema,
    }),
  ]),
]);

export type AdminMutationInput = z.infer<typeof adminMutationSchema>;
export type AdminRowRefInput = z.infer<typeof adminRowRefSchema>;
