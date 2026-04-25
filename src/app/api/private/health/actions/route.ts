import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

import {
  requestHasDashboardAccess,
  unauthorizedResponse,
} from "@/lib/auth/dashboard-auth";
import { getPortfolioCacheHealth, invalidatePortfolioCaches } from "@/lib/cache/portfolio-cache";
import { getEnv } from "@/lib/env";
import { getDashboardHealthSnapshot, runPriceProviderDiagnostics } from "@/lib/health/dashboard-health";
import { dashboardHealthActionSchema } from "@/lib/health/schema";
import { getPortfolioSnapshot } from "@/lib/portfolio/build-portfolio";
import { applyRateLimit, getClientIp } from "@/lib/security/rate-limit";
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
  const ip = getClientIp(request);
  const rateLimit = applyRateLimit(
    `health-actions:${ip}`,
    Math.max(8, Math.floor(env.RATE_LIMIT_MAX_REQUESTS / 2)),
    env.RATE_LIMIT_WINDOW_SECONDS * 1000,
  );

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Превышен лимит запросов к health actions." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfter),
          "Cache-Control": "no-store",
        },
      },
    );
  }

  if (!requestHasDashboardAccess(request)) {
    return unauthorizedResponse();
  }

  try {
    const rawPayload = await request.json().catch(() => null);
    const payload = dashboardHealthActionSchema.parse(rawPayload);

    if (payload.action === "refresh_cache") {
      const cacheBefore = getPortfolioCacheHealth();
      invalidatePortfolioCaches();
      await getPortfolioSnapshot();
      const health = await getDashboardHealthSnapshot();

      return NextResponse.json(
        {
          ok: true,
          action: payload.action,
          message: "Portfolio cache очищен и заново прогрет свежим snapshot.",
          health,
          cacheBefore,
          cacheAfter: health.cache,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (payload.action === "validate_google_sheet") {
      const health = await getDashboardHealthSnapshot();

      return NextResponse.json(
        {
          ok: true,
          action: payload.action,
          message: health.validation?.runtimeCompatible
            ? health.validation.canonicalReady
              ? "Google Sheet проходит runtime и canonical validation."
              : "Google Sheet читается корректно, но canonical структура еще не полностью готова."
            : "Google Sheet не проходит runtime validation.",
          health,
          validation: health.validation,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (payload.action === "test_price_providers") {
      const source = await getPortfolioSource();
      const diagnostics = await runPriceProviderDiagnostics(source.workbook);
      const health = await getDashboardHealthSnapshot();

      return NextResponse.json(
        {
          ok: true,
          action: payload.action,
          message: "Price providers проверены на sample data из текущего workbook.",
          diagnostics,
          health,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
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

      return NextResponse.json(
        {
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
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    } catch (error) {
      if (error instanceof SnapshotConflictError) {
        return NextResponse.json(
          {
            error: error.message,
            code: "snapshot_exists",
            conflict: {
              date: error.date,
              rowNumber: error.rowNumber,
              sheetName: error.sheetName,
            },
          },
          {
            status: 409,
            headers: {
              "Cache-Control": "no-store",
            },
          },
        );
      }

      throw error;
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Некорректный payload health action.",
          details: getValidationErrors(error),
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Не удалось выполнить health action.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
