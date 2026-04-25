import { NextRequest } from "next/server";

import { canManageWorkspace } from "@/lib/auth/authorization";
import { guardSaasApiRequest } from "@/lib/auth/saas-api";
import { getWorkspaceMembershipForUser, normalizeWorkspaceRole } from "@/lib/auth/workspace";
import { evaluateAlertRulesForWorkspace } from "@/lib/saas/alerts";
import { alertEvaluationSchema } from "@/lib/saas/schema";
import { privateApiError, privateApiJson, sanitizeErrorMessage } from "@/lib/security/http";

export async function POST(request: NextRequest) {
  const guard = await guardSaasApiRequest(request, {
    scope: "saas:alerts:evaluate",
    rateLimitMessage: "Слишком много запросов на проверку alerts.",
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

  const parsed = alertEvaluationSchema.safeParse(payload);
  if (!parsed.success) {
    return privateApiError(400, "workspaceId обязателен для проверки alerts.", {
      code: "invalid_alert_evaluation_payload",
      details: parsed.error.flatten(),
    });
  }

  const membership = await getWorkspaceMembershipForUser(guard.session!.user.id, parsed.data.workspaceId);
  if (!membership) {
    return privateApiError(404, "Workspace не найден или доступ к нему потерян.", {
      code: "workspace_not_found",
    });
  }

  if (!canManageWorkspace(normalizeWorkspaceRole(membership.role))) {
    return privateApiError(403, "Недостаточно прав для ручной проверки alerts.", {
      code: "alert_evaluation_forbidden",
    });
  }

  try {
    const result = await evaluateAlertRulesForWorkspace({
      workspaceId: parsed.data.workspaceId,
      triggeredByUserId: guard.session!.user.id,
      source: "manual",
    });

    return privateApiJson({ ok: true, result });
  } catch (error) {
    const message = sanitizeErrorMessage(error, "Не удалось выполнить проверку alerts.");
    return privateApiError(500, message, {
      code: "alert_evaluation_failed",
    });
  }
}
