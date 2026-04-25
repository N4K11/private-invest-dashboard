import { z } from "zod";

import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";

const emailSchema = z
  .string()
  .trim()
  .min(1, "Укажите email.")
  .email("Укажите корректный email.")
  .max(160)
  .transform((value) => value.toLowerCase());

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Пароль должен быть не короче ${PASSWORD_MIN_LENGTH} символов.`)
  .max(128, "Пароль слишком длинный.")
  .refine((value) => /[a-zA-Z]/.test(value), {
    message: "Пароль должен содержать хотя бы одну букву.",
  })
  .refine((value) => /\d/.test(value), {
    message: "Пароль должен содержать хотя бы одну цифру.",
  });

export const credentialsSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Укажите пароль.").max(128),
});

export const registerSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Укажите имя или ник.")
    .max(80, "Имя слишком длинное."),
  email: emailSchema,
  password: passwordSchema,
  workspaceName: z
    .string()
    .trim()
    .min(2, "Название workspace слишком короткое.")
    .max(80, "Название workspace слишком длинное.")
    .optional()
    .or(z.literal(""))
    .transform((value) => value || undefined),
  timezone: z
    .string()
    .trim()
    .min(2, "Некорректный часовой пояс.")
    .max(80, "Некорректный часовой пояс.")
    .optional()
    .or(z.literal(""))
    .transform((value) => value || undefined),
});

export type CredentialsInput = z.infer<typeof credentialsSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
