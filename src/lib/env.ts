import { z } from "zod";

import {
  DASHBOARD_SLUG_PLACEHOLDER,
  DEFAULT_CURRENCY,
} from "@/lib/constants";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PRIVATE_DASHBOARD_SLUG: z
    .string()
    .trim()
    .min(1)
    .default(DASHBOARD_SLUG_PLACEHOLDER),
  DASHBOARD_SECRET_TOKEN: z.string().trim().default(""),
  GOOGLE_SHEETS_SPREADSHEET_ID: z.string().trim().optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().trim().optional(),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().trim().optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().trim().optional(),
  COINGECKO_API_KEY: z.string().trim().optional(),
  CS2_PROVIDER_ORDER: z.string().trim().default("steam,manual"),
  CS2_PRICE_STALE_HOURS: z.coerce.number().int().min(1).default(72),
  CS2_BUFF_PROXY_URL: z.string().trim().url().optional(),
  CSFLOAT_API_KEY: z.string().trim().optional(),
  PRICEMPIRE_API_KEY: z.string().trim().optional(),
  DEFAULT_CURRENCY: z.string().trim().min(3).default(DEFAULT_CURRENCY),
  PORTFOLIO_CACHE_TTL_SECONDS: z.coerce.number().int().min(30).default(300),
  PRICE_CACHE_TTL_SECONDS: z.coerce.number().int().min(30).default(120),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(10).default(60),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(25),
  NEXT_PUBLIC_SITE_URL: z.string().trim().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

function normalizeSpreadsheetId(value?: string) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? trimmed;
}

export function getEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = envSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    PRIVATE_DASHBOARD_SLUG: process.env.PRIVATE_DASHBOARD_SLUG,
    DASHBOARD_SECRET_TOKEN: process.env.DASHBOARD_SECRET_TOKEN,
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
    CSFLOAT_API_KEY: process.env.CSFLOAT_API_KEY,
    PRICEMPIRE_API_KEY: process.env.PRICEMPIRE_API_KEY,
    DEFAULT_CURRENCY: process.env.DEFAULT_CURRENCY,
    PORTFOLIO_CACHE_TTL_SECONDS: process.env.PORTFOLIO_CACHE_TTL_SECONDS,
    PRICE_CACHE_TTL_SECONDS: process.env.PRICE_CACHE_TTL_SECONDS,
    RATE_LIMIT_WINDOW_SECONDS: process.env.RATE_LIMIT_WINDOW_SECONDS,
    RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });

  return cachedEnv;
}

export function isDashboardConfigured() {
  const env = getEnv();

  return Boolean(
    env.PRIVATE_DASHBOARD_SLUG &&
      env.PRIVATE_DASHBOARD_SLUG !== DASHBOARD_SLUG_PLACEHOLDER &&
      env.DASHBOARD_SECRET_TOKEN.length >= 12,
  );
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
