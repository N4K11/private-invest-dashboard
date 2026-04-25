import { z } from "zod";

const currencySchema = z
  .string()
  .trim()
  .min(3, "Укажите валюту портфеля.")
  .max(8, "Валюта портфеля слишком длинная.")
  .transform((value) => value.toUpperCase());

const riskProfileSchema = z
  .string()
  .trim()
  .min(2, "Укажите риск-профиль.")
  .max(40, "Риск-профиль слишком длинный.")
  .transform((value) => value.toLowerCase());

const visibilitySchema = z.enum(["private", "shared_link", "workspace"]);

export const workspaceCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Название workspace слишком короткое.")
    .max(80, "Название workspace слишком длинное."),
  timezone: z
    .string()
    .trim()
    .min(2, "Укажите корректный часовой пояс.")
    .max(80, "Укажите корректный часовой пояс.")
    .optional()
    .or(z.literal(""))
    .transform((value) => value || undefined),
});

export const workspaceSelectionSchema = z.object({
  workspaceSlug: z
    .string()
    .trim()
    .min(1, "Не удалось определить workspace для переключения.")
    .max(120),
});

export const portfolioCreateSchema = z.object({
  workspaceId: z.string().trim().min(1, "Не найден workspace для создания портфеля."),
  name: z
    .string()
    .trim()
    .min(2, "Название портфеля слишком короткое.")
    .max(80, "Название портфеля слишком длинное."),
  baseCurrency: currencySchema.default("USD"),
  visibility: visibilitySchema.default("private"),
  riskProfile: riskProfileSchema.default("balanced"),
});

export const portfolioUpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Название портфеля слишком короткое.")
      .max(80, "Название портфеля слишком длинное.")
      .optional(),
    baseCurrency: currencySchema.optional(),
    visibility: visibilitySchema.optional(),
    riskProfile: riskProfileSchema.optional(),
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: "Передайте хотя бы одно поле для обновления портфеля.",
  });

export type WorkspaceCreateInput = z.infer<typeof workspaceCreateSchema>;
export type WorkspaceSelectionInput = z.infer<typeof workspaceSelectionSchema>;
export type PortfolioCreateInput = z.infer<typeof portfolioCreateSchema>;
export type PortfolioUpdateInput = z.infer<typeof portfolioUpdateSchema>;
