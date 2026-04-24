import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  clearDashboardSessionCookie,
  isValidDashboardToken,
  sanitizeRedirectPath,
  setDashboardSessionCookie,
  unauthorizedResponse,
} from "@/lib/auth/dashboard-auth";
import { getEnv, isDashboardConfigured } from "@/lib/env";
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
    return NextResponse.json(
      { error: "Слишком много попыток входа. Попробуй позже." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfter),
          "Cache-Control": "no-store",
        },
      },
    );
  }

  if (!isDashboardConfigured()) {
    return NextResponse.json(
      { error: "Секреты dashboard еще не настроены." },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const payload = loginPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json(
      { error: "Некорректный auth payload." },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  if (!isValidDashboardToken(payload.data.token)) {
    return unauthorizedResponse("Неверный токен dashboard.");
  }

  const response = NextResponse.json(
    {
      ok: true,
      redirectTo: sanitizeRedirectPath(payload.data.redirectTo),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );

  return setDashboardSessionCookie(response);
}

export async function DELETE() {
  const response = NextResponse.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );

  return clearDashboardSessionCookie(response);
}
