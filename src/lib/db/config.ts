import "server-only";

import { z } from "zod";

const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().trim().min(1).optional(),
  DIRECT_URL: z.string().trim().min(1).optional(),
});

export type DatabaseConfig = {
  databaseUrl: string | null;
  directUrl: string | null;
  isConfigured: boolean;
  hasDirectUrl: boolean;
};

let cachedConfig: DatabaseConfig | null = null;

export function getDatabaseConfig(env: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  if (env === process.env && cachedConfig) {
    return cachedConfig;
  }

  const parsed = databaseEnvSchema.parse({
    DATABASE_URL: env.DATABASE_URL,
    DIRECT_URL: env.DIRECT_URL,
  });

  const config: DatabaseConfig = {
    databaseUrl: parsed.DATABASE_URL ?? null,
    directUrl: parsed.DIRECT_URL ?? null,
    isConfigured: Boolean(parsed.DATABASE_URL),
    hasDirectUrl: Boolean(parsed.DIRECT_URL),
  };

  if (env === process.env) {
    cachedConfig = config;
  }

  return config;
}

export function isDatabaseConfigured() {
  return getDatabaseConfig().isConfigured;
}