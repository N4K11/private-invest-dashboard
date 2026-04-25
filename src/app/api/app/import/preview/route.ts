import { NextRequest } from "next/server";

import { canManagePortfolio } from "@/lib/auth/authorization";
import { guardSaasApiRequest } from "@/lib/auth/saas-api";
import { getPortfolioMembershipForUser, normalizeWorkspaceRole } from "@/lib/auth/workspace";
import { buildImportPreview } from "@/lib/imports/preview";
import { importPreviewRequestSchema } from "@/lib/imports/schema";
import {
  privateApiError,
  privateApiJson,
  sanitizeErrorMessage,
} from "@/lib/security/http";

export async function POST(request: NextRequest) {
  const guard = await guardSaasApiRequest(request, {
    scope: "saas:import:preview",
    rateLimitMessage: "Слишком много запросов на preview импорта.",
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

  const parsed = importPreviewRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return privateApiError(400, "Проверьте параметры preview импорта.", {
      code: "invalid_import_preview_payload",
      details: parsed.error.flatten(),
    });
  }

  const membership = await getPortfolioMembershipForUser(
    guard.session!.user.id,
    parsed.data.portfolioId,
  );

  if (!membership) {
    return privateApiError(404, "Портфель не найден или доступ к нему отсутствует.", {
      code: "portfolio_not_found",
    });
  }

  if (!canManagePortfolio(normalizeWorkspaceRole(membership.role))) {
    return privateApiError(403, "Недостаточно прав для preview импорта в этот портфель.", {
      code: "import_preview_forbidden",
    });
  }

  try {
    const preview = await buildImportPreview(parsed.data);
    return privateApiJson({ ok: true, preview });
  } catch (error) {
    return privateApiError(
      500,
      sanitizeErrorMessage(error, "Не удалось построить preview импорта."),
      { code: "import_preview_failed" },
    );
  }
}
