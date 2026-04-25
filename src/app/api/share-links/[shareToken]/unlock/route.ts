import { NextRequest } from "next/server";
import { z } from "zod";

import { setShareAccessCookie, unlockShareLink } from "@/lib/saas/sharing";
import { getEnv } from "@/lib/env";
import { privateApiError, privateApiJson, sanitizeErrorMessage } from "@/lib/security/http";
import { applyRateLimit, getClientIp } from "@/lib/security/rate-limit";

type RouteContext = {
  params: Promise<{
    shareToken: string;
  }>;
};

const payloadSchema = z.object({
  password: z.string().trim().min(1, "Password is required."),
});

function inferStatus(message: string) {
  if (message.includes("Incorrect share password")) {
    return 401;
  }

  if (message.includes("expired") || message.includes("revoked")) {
    return 410;
  }

  if (message.includes("not found")) {
    return 404;
  }

  return 400;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const env = getEnv();
  const rateLimit = applyRateLimit(
    `share-link:unlock:${getClientIp(request)}`,
    Math.min(env.AUTH_RATE_LIMIT_MAX_REQUESTS, 10),
    env.AUTH_RATE_LIMIT_WINDOW_SECONDS * 1000,
  );

  if (!rateLimit.success) {
    return privateApiError(429, "Too many share unlock attempts.", {
      code: "share_unlock_rate_limited",
      extraBody: {
        retryAfter: rateLimit.retryAfter,
      },
      headers: {
        "Retry-After": String(rateLimit.retryAfter),
      },
    });
  }

  const { shareToken } = await context.params;

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return privateApiError(400, "Invalid JSON payload.");
  }

  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    return privateApiError(400, "Password is required to unlock this shared view.", {
      code: "invalid_share_unlock_payload",
      details: parsed.error.flatten(),
    });
  }

  try {
    const grant = await unlockShareLink(shareToken, parsed.data.password);
    const response = privateApiJson({ ok: true });
    return setShareAccessCookie(response, grant);
  } catch (error) {
    const message = sanitizeErrorMessage(error, "Failed to unlock shared view.");
    return privateApiError(inferStatus(message), message, {
      code: "share_unlock_failed",
    });
  }
}