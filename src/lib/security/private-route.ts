import type { NextRequest } from "next/server";

import {
  requestHasDashboardAccess,
  unauthorizedResponse,
} from "@/lib/auth/dashboard-auth";
import { getEnv } from "@/lib/env";
import { privateApiRateLimitError } from "@/lib/security/http";
import { applyRateLimit, getClientIp } from "@/lib/security/rate-limit";

type PrivateApiGuardOptions = {
  scope: string;
  maxRequests?: number;
  windowMs?: number;
  rateLimitMessage?: string;
  unauthorizedMessage?: string;
};

export function guardPrivateApiRequest(
  request: NextRequest,
  options: PrivateApiGuardOptions,
) {
  const env = getEnv();
  const ip = getClientIp(request);
  const rateLimit = applyRateLimit(
    `${options.scope}:${ip}`,
    options.maxRequests ?? env.RATE_LIMIT_MAX_REQUESTS,
    options.windowMs ?? env.RATE_LIMIT_WINDOW_SECONDS * 1000,
  );

  if (!rateLimit.success) {
    return privateApiRateLimitError(
      options.rateLimitMessage ?? "Превышен лимит запросов.",
      rateLimit.retryAfter,
    );
  }

  if (!requestHasDashboardAccess(request)) {
    return unauthorizedResponse(options.unauthorizedMessage);
  }

  return null;
}
