import { type NextRequest } from "next/server";
import { z } from "zod";

import {
  clearDashboardSessionCookie,
  isValidDashboardToken,
  sanitizeRedirectPath,
  setDashboardSessionCookie,
  unauthorizedResponse,
} from "@/lib/auth/dashboard-auth";
import { getEnv, isDashboardConfigured } from "@/lib/env";
import {
  privateApiError,
  privateApiJson,
  privateApiRateLimitError,
  sanitizeErrorMessage,
} from "@/lib/security/http";
import { applyRateLimit, getClientIp } from "@/lib/security/rate-limit";

const loginPayloadSchema = z.object({
  token: z.string().trim().min(1),
  redirectTo: z.string().trim().optional(),
});

export async function POST(request: NextRequest) {
  const env = getEnv();
  const ip = getClientIp(request);
  const rateLimit = applyRateLimit(
    `auth:${ip}`,
    env.RATE_LIMIT_MAX_REQUESTS,
    env.RATE_LIMIT_WINDOW_SECONDS * 1000,
  );

  if (!rateLimit.success) {
    return privateApiRateLimitError(
      "Слишком много попыток входа. Попробуй позже.",
      rateLimit.retryAfter,
    );
  }

  try {
    if (!isDashboardConfigured()) {
      return privateApiError(503, "Секреты dashboard еще не настроены.");
    }

    const payload = loginPayloadSchema.safeParse(await request.json().catch(() => null));
    if (!payload.success) {
      return privateApiError(400, "Некорректный auth payload.");
    }

    if (!isValidDashboardToken(payload.data.token)) {
      return unauthorizedResponse("Неверный токен dashboard.");
    }

    const response = privateApiJson({
      ok: true,
      redirectTo: sanitizeRedirectPath(payload.data.redirectTo),
    });

    return setDashboardSessionCookie(response);
  } catch (error) {
    return privateApiError(
      500,
      sanitizeErrorMessage(error, "Не удалось завершить dashboard login."),
    );
  }
}

export async function DELETE() {
  try {
    const response = privateApiJson({ ok: true });
    return clearDashboardSessionCookie(response);
  } catch (error) {
    return privateApiError(
      500,
      sanitizeErrorMessage(error, "Не удалось завершить dashboard logout."),
    );
  }
}
