import { z } from "zod";

const currencySchema = z
  .string()
  .trim()
  .min(3, "Provide a portfolio currency.")
  .max(8, "Portfolio currency is too long.")
  .transform((value) => value.toUpperCase());

const riskProfileSchema = z
  .string()
  .trim()
  .min(2, "Provide a risk profile.")
  .max(40, "Risk profile is too long.")
  .transform((value) => value.toLowerCase());

const visibilitySchema = z.enum(["private", "shared_link", "workspace"]);
const manualAssetCategorySchema = z.enum(["cs2", "telegram", "crypto", "custom"]);
const manualAssetLiquiditySchema = z.enum(["high", "medium", "low", "unknown"]);
const manualAssetConfidenceSchema = z.enum(["high", "medium", "low"]);
const manualAssetCreateModeSchema = z.enum(["buy", "adjustment"]);
const manualAssetUpdateModeSchema = z.enum(["buy", "sell", "adjustment"]);

const decimalSchema = z.coerce.number().finite("Enter a valid number.").min(0, "Value cannot be negative.");

const positiveQuantitySchema = decimalSchema.refine((value) => value > 0, {
  message: "Quantity must be greater than zero.",
});

const textAreaSchema = z
  .string()
  .trim()
  .max(2000, "Text is too long.")
  .optional()
  .or(z.literal(""))
  .transform((value) => value || undefined);

const tagsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, "Empty tags are not allowed.")
      .max(32, "Tag is too long."),
  )
  .max(12, "Too many tags.")
  .default([]);

const optionalDecimalSchema = decimalSchema.nullable().optional();

export const workspaceCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Workspace name is too short.")
    .max(80, "Workspace name is too long."),
  timezone: z
    .string()
    .trim()
    .min(2, "Provide a valid timezone.")
    .max(80, "Provide a valid timezone.")
    .optional()
    .or(z.literal(""))
    .transform((value) => value || undefined),
});

export const workspaceSelectionSchema = z.object({
  workspaceSlug: z.string().trim().min(1, "Workspace slug is missing.").max(120),
});

export const portfolioCreateSchema = z.object({
  workspaceId: z.string().trim().min(1, "Workspace id is required."),
  name: z
    .string()
    .trim()
    .min(2, "Portfolio name is too short.")
    .max(80, "Portfolio name is too long."),
  baseCurrency: currencySchema.default("USD"),
  visibility: visibilitySchema.default("private"),
  riskProfile: riskProfileSchema.default("balanced"),
});

export const portfolioUpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Portfolio name is too short.")
      .max(80, "Portfolio name is too long.")
      .optional(),
    baseCurrency: currencySchema.optional(),
    visibility: visibilitySchema.optional(),
    riskProfile: riskProfileSchema.optional(),
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: "Provide at least one portfolio field to update.",
  });

export const manualAssetCreateSchema = z.object({
  category: manualAssetCategorySchema,
  name: z
    .string()
    .trim()
    .min(2, "Asset name is too short.")
    .max(120, "Asset name is too long."),
  quantity: positiveQuantitySchema,
  entryPrice: optionalDecimalSchema,
  currentManualPrice: optionalDecimalSchema,
  currency: currencySchema.default("USD"),
  notes: textAreaSchema,
  tags: tagsSchema,
  liquidity: manualAssetLiquiditySchema.default("unknown"),
  confidence: manualAssetConfidenceSchema.default("medium"),
  transactionMode: manualAssetCreateModeSchema.default("buy"),
});

export const manualAssetUpdateSchema = z.object({
  category: manualAssetCategorySchema,
  name: z
    .string()
    .trim()
    .min(2, "Asset name is too short.")
    .max(120, "Asset name is too long."),
  quantity: decimalSchema,
  entryPrice: optionalDecimalSchema,
  currentManualPrice: optionalDecimalSchema,
  currency: currencySchema,
  notes: textAreaSchema,
  tags: tagsSchema,
  liquidity: manualAssetLiquiditySchema.default("unknown"),
  confidence: manualAssetConfidenceSchema.default("medium"),
  transactionMode: manualAssetUpdateModeSchema.default("adjustment"),
});

export type WorkspaceCreateInput = z.infer<typeof workspaceCreateSchema>;
export type WorkspaceSelectionInput = z.infer<typeof workspaceSelectionSchema>;
export type PortfolioCreateInput = z.infer<typeof portfolioCreateSchema>;
export type PortfolioUpdateInput = z.infer<typeof portfolioUpdateSchema>;
export type ManualAssetCreateInput = z.infer<typeof manualAssetCreateSchema>;
export type ManualAssetUpdateInput = z.infer<typeof manualAssetUpdateSchema>;