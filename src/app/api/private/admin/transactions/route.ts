import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

import {
  requestHasDashboardAccess,
  unauthorizedResponse,
} from "@/lib/auth/dashboard-auth";
import { adminTransactionMutationSchema } from "@/lib/admin/schema";
import { getEnv } from "@/lib/env";
import { applyRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { applyTransactionMutation } from "@/lib/sheets/writeback";

function getValidationErrors(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

export async function POST(request: NextRequest) {
  const env = getEnv();
  const ip = getClientIp(request);
  const rateLimit = applyRateLimit(
    `admin-write:transactions:${ip}`,
    Math.max(8, Math.floor(env.RATE_LIMIT_MAX_REQUESTS / 2)),
    env.RATE_LIMIT_WINDOW_SECONDS * 1000,
  );

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Превышен лимит запросов на запись." },
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
    const payload = adminTransactionMutationSchema.parse(rawPayload);
    const result = await applyTransactionMutation(payload);

    return NextResponse.json(
      {
        ok: true,
        result,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Некорректный payload транзакции.",
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
            : "Не удалось записать транзакцию в Google Sheets.",
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
