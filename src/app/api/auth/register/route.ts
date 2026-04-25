import { NextRequest } from "next/server";

import { registerSchema } from "@/lib/auth/schema";
import { registerUser } from "@/lib/auth/registration";
import { isSaasAuthConfigured } from "@/lib/env";
import { privateApiError, privateApiJson, sanitizeErrorMessage } from "@/lib/security/http";
import { applyRateLimit, getClientIp } from "@/lib/security/rate-limit";

const REGISTER_RATE_LIMIT_MAX = 8;
const REGISTER_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rateLimit = applyRateLimit(
    `auth:register:${ip}`,
    REGISTER_RATE_LIMIT_MAX,
    REGISTER_RATE_LIMIT_WINDOW_MS,
  );

  if (!rateLimit.success) {
    return privateApiError(429, "Слишком много попыток регистрации. Попробуйте позже.", {
      headers: {
        "Retry-After": String(rateLimit.retryAfter),
      },
    });
  }

  if (!isSaasAuthConfigured()) {
    return privateApiError(
      503,
      "SaaS-авторизация еще не настроена для этого окружения.",
      { code: "saas_auth_not_configured" },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return privateApiError(400, "Некорректный JSON в запросе.");
  }

  const parsed = registerSchema.safeParse(payload);
  if (!parsed.success) {
    return privateApiError(400, "Проверьте поля формы регистрации.", {
      code: "invalid_registration_payload",
      details: parsed.error.flatten(),
    });
  }

  try {
    const result = await registerUser(parsed.data);

    return privateApiJson(
      {
        ok: true,
        user: {
          id: result.user.id,
          email: result.user.email,
          displayName: result.user.displayName,
        },
        workspace: {
          id: result.workspace.id,
          slug: result.workspace.slug,
          name: result.workspace.name,
        },
        portfolio: {
          id: result.portfolio.id,
          slug: result.portfolio.slug,
          name: result.portfolio.name,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message = sanitizeErrorMessage(
      error,
      "Не удалось завершить регистрацию. Попробуйте еще раз.",
    );
    const status = message.includes("уже существует") ? 409 : 500;

    return privateApiError(status, message, {
      code: status === 409 ? "email_exists" : "registration_failed",
    });
  }
}
