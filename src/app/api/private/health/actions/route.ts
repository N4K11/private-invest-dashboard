import { type NextRequest } from "next/server";
import { ZodError } from "zod";

import {
  getPortfolioCacheHealth,
  invalidatePortfolioCaches,
} from "@/lib/cache/portfolio-cache";
import { getEnv } from "@/lib/env";
import { getDashboardHealthSnapshot, runPriceProviderDiagnostics } from "@/lib/health/dashboard-health";
import { dashboardHealthActionSchema } from "@/lib/health/schema";
import { getPortfolioSnapshot } from "@/lib/portfolio/build-portfolio";
import {
  privateApiError,
  privateApiJson,
  sanitizeErrorMessage,
} from "@/lib/security/http";
import { guardPrivateApiRequest } from "@/lib/security/private-route";
import { getPortfolioSource } from "@/lib/sheets/reader";
import { applyPortfolioSnapshotMutation, SnapshotConflictError } from "@/lib/sheets/writeback";

function getValidationErrors(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

function getDateKey(value?: string) {
  if (value) {
    return value;
  }

  return new Date().toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  const env = getEnv();
  const blockedResponse = guardPrivateApiRequest(request, {
    scope: "health-actions",
    maxRequests: Math.max(8, Math.floor(env.RATE_LIMIT_MAX_REQUESTS / 2)),
    rateLimitMessage: "Превышен лимит запросов к health actions.",
  });

  if (blockedResponse) {
    return blockedResponse;
  }

  try {
    const rawPayload = await request.json().catch(() => null);
    const payload = dashboardHealthActionSchema.parse(rawPayload);

    if (payload.action === "refresh_cache") {
      const cacheBefore = await getPortfolioCacheHealth();
      await invalidatePortfolioCaches();
      await getPortfolioSnapshot();
      const health = await getDashboardHealthSnapshot();

      return privateApiJson({
        ok: true,
        action: payload.action,
        message: "Portfolio cache очищен и заново прогрет свежим snapshot.",
        health,
        cacheBefore,
        cacheAfter: health.cache,
      });
    }

    if (payload.action === "validate_google_sheet") {
      const health = await getDashboardHealthSnapshot();

      return privateApiJson({
        ok: true,
        action: payload.action,
        message: health.validation?.runtimeCompatible
          ? health.validation.canonicalReady
            ? "Google Sheet проходит runtime и canonical validation."
            : "Google Sheet читается корректно, но canonical структура еще не полностью готова."
          : "Google Sheet не проходит runtime validation.",
        health,
        validation: health.validation,
      });
    }

    if (payload.action === "test_price_providers") {
      const source = await getPortfolioSource();
      const diagnostics = await runPriceProviderDiagnostics(source.workbook);
      const health = await getDashboardHealthSnapshot();

      return privateApiJson({
        ok: true,
        action: payload.action,
        message: "Price providers проверены на sample data из текущего workbook.",
        diagnostics,
        health,
      });
    }

    try {
      const result = await applyPortfolioSnapshotMutation({
        operation: "capture",
        entityType: "portfolio_snapshot",
        data: {
          date: getDateKey(payload.date),
          notes: null,
          replaceExisting: payload.replaceExisting ?? false,
          source: "manual",
        },
      });
      const health = await getDashboardHealthSnapshot();

      return privateApiJson({
        ok: true,
        action: payload.action,
        message:
          result.operation === "update"
            ? "Сегодняшний snapshot обновлен в Portfolio_History."
            : "Daily snapshot сохранен в Portfolio_History.",
        health,
        snapshotResult: {
          operation: result.operation,
          date: result.date,
        },
      });
    } catch (error) {
      if (error instanceof SnapshotConflictError) {
        return privateApiError(409, error.message, {
          code: "snapshot_exists",
          extraBody: {
            conflict: {
              date: error.date,
              rowNumber: error.rowNumber,
              sheetName: error.sheetName,
            },
          },
        });
      }

      throw error;
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return privateApiError(400, "Некорректный payload health action.", {
        details: getValidationErrors(error),
      });
    }

    return privateApiError(
      500,
      sanitizeErrorMessage(error, "Не удалось выполнить health action."),
    );
  }
}
