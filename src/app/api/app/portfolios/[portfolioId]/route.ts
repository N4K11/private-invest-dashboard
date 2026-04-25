import { NextRequest } from "next/server";

import { guardSaasApiRequest } from "@/lib/auth/saas-api";
import {
  archivePortfolioById,
  updatePortfolioById,
} from "@/lib/saas/portfolios";
import { portfolioUpdateSchema } from "@/lib/saas/schema";
import {
  privateApiError,
  privateApiJson,
  sanitizeErrorMessage,
} from "@/lib/security/http";

type RouteContext = {
  params: Promise<{
    portfolioId: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const guard = await guardSaasApiRequest(request, {
    scope: "saas:portfolios:update",
    rateLimitMessage: "Слишком много запросов на обновление портфеля.",
  });

  if (guard.response) {
    return guard.response;
  }

  const { portfolioId } = await context.params;

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return privateApiError(400, "Некорректный JSON в запросе.");
  }

  const parsed = portfolioUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return privateApiError(400, "Проверьте поля обновления портфеля.", {
      code: "invalid_portfolio_update_payload",
      details: parsed.error.flatten(),
    });
  }

  try {
    const portfolio = await updatePortfolioById(
      guard.session!.user.id,
      portfolioId,
      parsed.data,
    );

    return privateApiJson({
      ok: true,
      portfolio: {
        id: portfolio.id,
        name: portfolio.name,
        baseCurrency: portfolio.baseCurrency,
        visibility: portfolio.visibility,
        riskProfile: portfolio.riskProfile,
      },
    });
  } catch (error) {
    const message = sanitizeErrorMessage(error, "Не удалось обновить портфель.");
    const status = message.includes("Недостаточно прав") ? 403 : message.includes("не найден") ? 404 : 500;

    return privateApiError(status, message, {
      code: status === 403 ? "portfolio_forbidden" : "portfolio_update_failed",
    });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const guard = await guardSaasApiRequest(request, {
    scope: "saas:portfolios:archive",
    rateLimitMessage: "Слишком много запросов на удаление портфеля.",
  });

  if (guard.response) {
    return guard.response;
  }

  const { portfolioId } = await context.params;

  try {
    const portfolio = await archivePortfolioById(guard.session!.user.id, portfolioId);

    return privateApiJson({
      ok: true,
      portfolio: {
        id: portfolio.id,
        name: portfolio.name,
        isArchived: portfolio.isArchived,
      },
    });
  } catch (error) {
    const message = sanitizeErrorMessage(error, "Не удалось архивировать портфель.");
    const status =
      message.includes("Недостаточно прав")
        ? 403
        : message.includes("не найден")
          ? 404
          : message.includes("последний портфель")
            ? 409
            : 500;

    return privateApiError(status, message, {
      code: status === 403 ? "portfolio_forbidden" : "portfolio_archive_failed",
    });
  }
}
