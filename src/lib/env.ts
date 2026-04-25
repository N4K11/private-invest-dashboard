import "server-only";

import { z } from "zod";

import { DASHBOARD_SLUG_PLACEHOLDER, DEFAULT_CURRENCY } from "@/lib/constants";
import { isDatabaseConfigured } from "@/lib/db/config";

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PRIVATE_DASHBOARD_SLUG: z
      .string()
      .trim()
      .min(1)
      .default(DASHBOARD_SLUG_PLACEHOLDER),
    DASHBOARD_SECRET_TOKEN: z.string().trim().default(""),
    AUTH_SECRET: z.string().trim().optional(),
    NEXTAUTH_SECRET: z.string().trim().optional(),
    NEXTAUTH_URL: z.string().trim().url().optional(),
    GOOGLE_SHEETS_SPREADSHEET_ID: z.string().trim().optional(),
    GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().trim().optional(),
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().trim().optional(),
    GOOGLE_SERVICE_ACCOUNT_JSON: z.string().trim().optional(),
    COINGECKO_API_KEY: z.string().trim().optional(),
    CS2_PROVIDER_ORDER: z.string().trim().default("steam,manual"),
    CS2_PRICE_STALE_HOURS: z.coerce.number().int().min(1).default(72),
    CS2_BUFF_PROXY_URL: z.string().trim().url().optional(),
    CS2_BUFF_PROXY_TOKEN: z.string().trim().optional(),
    CS2_FX_FALLBACK_RATES_JSON: z.string().trim().optional(),
    CSFLOAT_API_KEY: z.string().trim().optional(),
    PRICEMPIRE_API_KEY: z.string().trim().optional(),
    TELEGRAM_PRICE_STALE_DAYS: z.coerce.number().int().min(1).default(14),
    DEFAULT_CURRENCY: z.string().trim().min(3).default(DEFAULT_CURRENCY),
    PORTFOLIO_CACHE_TTL_SECONDS: z.coerce.number().int().min(30).default(300),
    PRICE_CACHE_TTL_SECONDS: z.coerce.number().int().min(30).default(120),
    SAAS_CRYPTO_PRICE_TTL_SECONDS: z.coerce.number().int().min(30).default(120),
    SAAS_CS2_PRICE_TTL_SECONDS: z.coerce.number().int().min(30).default(900),
    SAAS_TELEGRAM_PRICE_TTL_SECONDS: z.coerce.number().int().min(30).default(1800),
    SAAS_CUSTOM_PRICE_TTL_SECONDS: z.coerce.number().int().min(30).default(1800),
    SAAS_MANUAL_PRICE_STALE_HOURS: z.coerce.number().int().min(1).default(168),
    RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(10).default(60),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(25),
    AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(10).default(60),
    AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(10),
    CACHE_DRIVER: z.enum(["memory", "redis_rest"]).default("memory"),
    CACHE_REDIS_REST_URL: z.string().trim().url().optional(),
    CACHE_REDIS_REST_TOKEN: z.string().trim().optional(),
    CACHE_KEY_PREFIX: z.string().trim().min(1).default("private-invest-dashboard"),
    NEXT_PUBLIC_SITE_URL: z.string().trim().optional(),
  })
  .superRefine((env, context) => {
    const hasSplitCredentials = Boolean(
      env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    );
    const hasPartialSplitCredentials =
      Boolean(env.GOOGLE_SERVICE_ACCOUNT_EMAIL) !==
      Boolean(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);

    if (hasPartialSplitCredentials && !env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"],
        message:
          "GOOGLE_SERVICE_ACCOUNT_EMAIL Рё GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY РґРѕР»Р¶РЅС‹ Р·Р°РґР°РІР°С‚СЊСЃСЏ РІРјРµСЃС‚Рµ, РµСЃР»Рё РЅРµ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ GOOGLE_SERVICE_ACCOUNT_JSON.",
      });
    }

    if (
      env.CACHE_DRIVER === "redis_rest" &&
      (!env.CACHE_REDIS_REST_URL || !env.CACHE_REDIS_REST_TOKEN)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CACHE_DRIVER"],
        message:
          "Р”Р»СЏ CACHE_DRIVER=redis_rest РЅСѓР¶РЅС‹ CACHE_REDIS_REST_URL Рё CACHE_REDIS_REST_TOKEN.",
      });
    }

    if (
      env.GOOGLE_SHEETS_SPREADSHEET_ID &&
      !env.GOOGLE_SERVICE_ACCOUNT_JSON &&
      !hasSplitCredentials
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["GOOGLE_SHEETS_SPREADSHEET_ID"],
        message:
          "Р”Р»СЏ live Google Sheets source РЅСѓР¶РµРЅ GOOGLE_SERVICE_ACCOUNT_JSON РёР»Рё РїР°СЂР° GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.",
      });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;
let startupValidated = false;

function normalizeSpreadsheetId(value?: string) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? trimmed;
}

function parseEnvironment() {
  return envSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    PRIVATE_DASHBOARD_SLUG: process.env.PRIVATE_DASHBOARD_SLUG,
    DASHBOARD_SECRET_TOKEN: process.env.DASHBOARD_SECRET_TOKEN,
    AUTH_SECRET: process.env.AUTH_SECRET,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    GOOGLE_SHEETS_SPREADSHEET_ID: normalizeSpreadsheetId(
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    ),
    GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    GOOGLE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
    COINGECKO_API_KEY: process.env.COINGECKO_API_KEY,
    CS2_PROVIDER_ORDER: process.env.CS2_PROVIDER_ORDER,
    CS2_PRICE_STALE_HOURS: process.env.CS2_PRICE_STALE_HOURS,
    CS2_BUFF_PROXY_URL: process.env.CS2_BUFF_PROXY_URL,
    CS2_BUFF_PROXY_TOKEN: process.env.CS2_BUFF_PROXY_TOKEN,
    CS2_FX_FALLBACK_RATES_JSON: process.env.CS2_FX_FALLBACK_RATES_JSON,
    CSFLOAT_API_KEY: process.env.CSFLOAT_API_KEY,
    PRICEMPIRE_API_KEY: process.env.PRICEMPIRE_API_KEY,
    TELEGRAM_PRICE_STALE_DAYS: process.env.TELEGRAM_PRICE_STALE_DAYS,
    DEFAULT_CURRENCY: process.env.DEFAULT_CURRENCY,
    PORTFOLIO_CACHE_TTL_SECONDS: process.env.PORTFOLIO_CACHE_TTL_SECONDS,
    PRICE_CACHE_TTL_SECONDS: process.env.PRICE_CACHE_TTL_SECONDS,
    SAAS_CRYPTO_PRICE_TTL_SECONDS: process.env.SAAS_CRYPTO_PRICE_TTL_SECONDS,
    SAAS_CS2_PRICE_TTL_SECONDS: process.env.SAAS_CS2_PRICE_TTL_SECONDS,
    SAAS_TELEGRAM_PRICE_TTL_SECONDS: process.env.SAAS_TELEGRAM_PRICE_TTL_SECONDS,
    SAAS_CUSTOM_PRICE_TTL_SECONDS: process.env.SAAS_CUSTOM_PRICE_TTL_SECONDS,
    SAAS_MANUAL_PRICE_STALE_HOURS: process.env.SAAS_MANUAL_PRICE_STALE_HOURS,
    RATE_LIMIT_WINDOW_SECONDS: process.env.RATE_LIMIT_WINDOW_SECONDS,
    RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
    AUTH_RATE_LIMIT_WINDOW_SECONDS: process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS,
    AUTH_RATE_LIMIT_MAX_REQUESTS: process.env.AUTH_RATE_LIMIT_MAX_REQUESTS,
    CACHE_DRIVER: process.env.CACHE_DRIVER,
    CACHE_REDIS_REST_URL: process.env.CACHE_REDIS_REST_URL,
    CACHE_REDIS_REST_TOKEN: process.env.CACHE_REDIS_REST_TOKEN,
    CACHE_KEY_PREFIX: process.env.CACHE_KEY_PREFIX,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
}

export function getEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = parseEnvironment();
  return cachedEnv;
}

export function validateEnvironmentOnStartup() {
  if (startupValidated) {
    return getEnv();
  }

  startupValidated = true;
  return getEnv();
}

function isDashboardConfiguredFromEnv(env: AppEnv) {
  return Boolean(
    env.PRIVATE_DASHBOARD_SLUG &&
      env.PRIVATE_DASHBOARD_SLUG !== DASHBOARD_SLUG_PLACEHOLDER &&
      env.DASHBOARD_SECRET_TOKEN.length >= 12,
  );
}

export function isDashboardConfigured() {
  return isDashboardConfiguredFromEnv(getEnv());
}

export function getAuthSecret() {
  const env = getEnv();
  return env.AUTH_SECRET ?? env.NEXTAUTH_SECRET ?? null;
}

export function isGoogleSheetsConfigured() {
  const env = getEnv();
  const hasJson = Boolean(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const hasSplitCredentials = Boolean(
    env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  );

  return Boolean(
    env.GOOGLE_SHEETS_SPREADSHEET_ID && (hasJson || hasSplitCredentials),
  );
}

export function isExternalCacheConfigured() {
  const env = getEnv();
  return env.CACHE_DRIVER === "redis_rest";
}

export function isSaasAuthConfigured() {
  return Boolean(isDatabaseConfigured() && getAuthSecret());
}


