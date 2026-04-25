import { z } from "zod";

import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";

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
const telegramPriceSourceSchema = z.enum([
  "fragment",
  "otc_deal",
  "marketplace_listing",
  "manual_estimate",
]);
const alertRuleTypeSchema = z.enum([
  "price_above",
  "price_below",
  "portfolio_value_change",
  "stale_price",
  "concentration_risk",
]);
const alertRuleStatusSchema = z.enum(["active", "paused"]);
const alertDirectionSchema = z.enum(["up", "down", "either"]);

const decimalSchema = z.coerce.number().finite("Enter a valid number.").min(0, "Value cannot be negative.");
const integerSchema = z.coerce.number().int("Enter a whole number.").min(0, "Value cannot be negative.");

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

const optionalIdSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((value) => (value ? value : undefined));

const optionalEmailSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((value) => value || undefined)
  .pipe(z.string().email("Provide a valid email.").optional());

const optionalIsoDateTimeSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((value) => !value || Number.isFinite(Date.parse(value)), {
    message: "Provide a valid verification date.",
  })
  .transform((value) => (value ? new Date(value).toISOString() : new Date().toISOString()));

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

export const telegramGiftPriceUpdateSchema = z.object({
  price: positiveQuantitySchema,
  currency: currencySchema.default("USD"),
  confidence: manualAssetConfidenceSchema.default("medium"),
  priceSource: telegramPriceSourceSchema.default("manual_estimate"),
  lastVerifiedAt: optionalIsoDateTimeSchema,
  notes: textAreaSchema,
});

export const alertRuleCreateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Alert name is too short.")
      .max(120, "Alert name is too long."),
    type: alertRuleTypeSchema,
    status: alertRuleStatusSchema.default("active"),
    portfolioId: optionalIdSchema,
    assetId: optionalIdSchema,
    thresholdValue: optionalDecimalSchema,
    thresholdPercent: optionalDecimalSchema,
    cooldownMinutes: integerSchema.min(5, "Cooldown must be at least 5 minutes.").default(1440),
    recipientEmail: optionalEmailSchema,
    direction: alertDirectionSchema.default("either"),
  })
  .superRefine((value, context) => {
    if ((value.type === "price_above" || value.type === "price_below") && !value.portfolioId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["portfolioId"],
        message: "Choose a portfolio for price alerts.",
      });
    }

    if ((value.type === "price_above" || value.type === "price_below") && !value.assetId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assetId"],
        message: "Choose an asset for price alerts.",
      });
    }

    if ((value.type === "price_above" || value.type === "price_below") && value.thresholdValue === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["thresholdValue"],
        message: "Set a price threshold.",
      });
    }

    if (value.type === "portfolio_value_change" && !value.portfolioId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["portfolioId"],
        message: "Choose a portfolio for portfolio value alerts.",
      });
    }

    if (value.type === "portfolio_value_change" && value.thresholdPercent === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["thresholdPercent"],
        message: "Set a percent threshold for portfolio value change alerts.",
      });
    }

    if (value.type === "concentration_risk" && !value.portfolioId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["portfolioId"],
        message: "Choose a portfolio for concentration alerts.",
      });
    }

    if (value.type === "concentration_risk" && value.thresholdPercent === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["thresholdPercent"],
        message: "Set a percent threshold for concentration alerts.",
      });
    }

    if (value.type !== "price_above" && value.type !== "price_below" && value.assetId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assetId"],
        message: "Asset selection is only used for price-above/price-below alerts.",
      });
    }
  });

export const alertRuleUpdateSchema = alertRuleCreateSchema;

const optionalFutureIsoDateTimeSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((value) => !value || Number.isFinite(Date.parse(value)), {
    message: "Provide a valid expiration date.",
  })
  .refine((value) => !value || new Date(value).getTime() > Date.now(), {
    message: "Expiration date must be in the future.",
  })
  .transform((value) => (value ? new Date(value).toISOString() : undefined));

const optionalSharePasswordSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((value) => !value || value.length >= PASSWORD_MIN_LENGTH, {
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`,
  })
  .refine((value) => !value || value.length <= 128, {
    message: "Password is too long.",
  })
  .transform((value) => value || undefined);

export const shareLinkCreateSchema = z.object({
  label: z
    .string()
    .trim()
    .min(2, "Share link label is too short.")
    .max(80, "Share link label is too long.")
    .optional()
    .or(z.literal(""))
    .transform((value) => value || undefined),
  password: optionalSharePasswordSchema,
  expiresAt: optionalFutureIsoDateTimeSchema,
  hideValues: z.boolean().default(false),
  hideQuantities: z.boolean().default(false),
  hidePnl: z.boolean().default(false),
  allocationOnly: z.boolean().default(false),
});

export const alertEvaluationSchema = z.object({
  workspaceId: z.string().trim().min(1, "Workspace id is required."),
});

export type WorkspaceCreateInput = z.infer<typeof workspaceCreateSchema>;
export type WorkspaceSelectionInput = z.infer<typeof workspaceSelectionSchema>;
export type PortfolioCreateInput = z.infer<typeof portfolioCreateSchema>;
export type PortfolioUpdateInput = z.infer<typeof portfolioUpdateSchema>;
export type ManualAssetCreateInput = z.infer<typeof manualAssetCreateSchema>;
export type ManualAssetUpdateInput = z.infer<typeof manualAssetUpdateSchema>;
export type TelegramGiftPriceUpdateInput = z.infer<typeof telegramGiftPriceUpdateSchema>;
export type AlertRuleCreateInput = z.infer<typeof alertRuleCreateSchema>;
export type AlertRuleUpdateInput = z.infer<typeof alertRuleUpdateSchema>;
export type AlertEvaluationInput = z.infer<typeof alertEvaluationSchema>;
export type ShareLinkCreateInput = z.infer<typeof shareLinkCreateSchema>;
