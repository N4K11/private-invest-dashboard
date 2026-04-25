import "server-only";

import type { Session } from "next-auth";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth/auth-options";
import { getEnv, isSaasAuthConfigured } from "@/lib/env";
import {
  privateApiError,
  privateApiRateLimitError,
} from "@/lib/security/http";
import { applyRateLimit, getClientIp } from "@/lib/security/rate-limit";

type GuardSaasApiOptions = {
  scope: string;
  maxRequests?: number;
  windowMs?: number;
  unauthorizedMessage?: string;
  rateLimitMessage?: string;
};

export async function guardSaasApiRequest(
  request: NextRequest,
  options: GuardSaasApiOptions,
): Promise<{ session: Session | null; response: Response | null }> {
  if (!isSaasAuthConfigured()) {
    return {
      session: null,
      response: privateApiError(503, "SaaS-режим еще не настроен для этого окружения.", {
        code: "saas_auth_not_configured",
      }),
    };
  }

  const env = getEnv();
  const ip = getClientIp(request);
  const rateLimit = applyRateLimit(
    `${options.scope}:${ip}`,
    options.maxRequests ?? env.RATE_LIMIT_MAX_REQUESTS,
    options.windowMs ?? env.RATE_LIMIT_WINDOW_SECONDS * 1000,
  );

  if (!rateLimit.success) {
    return {
      session: null,
      response: privateApiRateLimitError(
        options.rateLimitMessage ?? "Слишком много запросов к SaaS API.",
        rateLimit.retryAfter,
      ),
    };
  }

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      session: null,
      response: privateApiError(401, options.unauthorizedMessage ?? "Нужна авторизация."),
    };
  }

  return {
    session,
    response: null,
  };
}
