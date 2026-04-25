import { NextRequest } from "next/server";

import { guardSaasApiRequest } from "@/lib/auth/saas-api";
import { isWorkspaceLimitError } from "@/lib/saas/limits";
import { createPortfolioForWorkspace } from "@/lib/saas/portfolios";
import { portfolioCreateSchema } from "@/lib/saas/schema";
import {
  privateApiError,
  privateApiJson,
  sanitizeErrorMessage,
} from "@/lib/security/http";

export async function POST(request: NextRequest) {
  const guard = await guardSaasApiRequest(request, {
    scope: "saas:portfolios:create",
    rateLimitMessage: "Слишком много запросов на создание портфеля.",
  });

  if (guard.response) {
    return guard.response;
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return privateApiError(400, "Некорректный JSON в запросе.");
  }

  const parsed = portfolioCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return privateApiError(400, "Проверьте поля создания портфеля.", {
      code: "invalid_portfolio_payload",
      details: parsed.error.flatten(),
    });
  }

  try {
    const portfolio = await createPortfolioForWorkspace(
      guard.session!.user.id,
      parsed.data.workspaceId,
      parsed.data,
    );

    return privateApiJson(
      {
        ok: true,
        portfolio: {
          id: portfolio.id,
          name: portfolio.name,
          slug: portfolio.slug,
          baseCurrency: portfolio.baseCurrency,
          visibility: portfolio.visibility,
          riskProfile: portfolio.riskProfile,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message = sanitizeErrorMessage(error, "Не удалось создать портфель.");
    const status = isWorkspaceLimitError(error) ? 409 : message.includes("Недостаточно прав") ? 403 : message.includes("не найден") ? 404 : 500;

    return privateApiError(status, message, {
      code: status === 409 ? "portfolio_limit_reached" : status === 403 ? "portfolio_forbidden" : "portfolio_create_failed",
    });
  }
}
