import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { getDatabaseConfig } from "@/lib/db/config";

const globalForPrisma = globalThis as typeof globalThis & {
  __saasPrismaClient?: PrismaClient;
};

export function getPrismaClient() {
  if (globalForPrisma.__saasPrismaClient) {
    return globalForPrisma.__saasPrismaClient;
  }

  const databaseConfig = getDatabaseConfig();
  if (!databaseConfig.databaseUrl) {
    throw new Error("DATABASE_URL is required for SaaS database access.");
  }

  const adapter = new PrismaPg(databaseConfig.databaseUrl);
  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.__saasPrismaClient = client;
  }

  return client;
}