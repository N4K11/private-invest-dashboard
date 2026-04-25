import { NextRequest } from "next/server";
import { z } from "zod";

import { guardSaasApiRequest } from "@/lib/auth/saas-api";
import { deleteAlertRuleById, updateAlertRuleById } from "@/lib/saas/alerts";
import { alertRuleUpdateSchema } from "@/lib/saas/schema";
import { privateApiError, privateApiJson, sanitizeErrorMessage } from "@/lib/security/http";

type RouteContext = {
  params: Promise<{
    ruleId: string;
  }>;
};

const requestSchema = alertRuleUpdateSchema.extend({
  workspaceId: z.string().trim().min(1, "Workspace id is required."),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  const guard = await guardSaasApiRequest(request, {
    scope: "saas:alerts:update",
    rateLimitMessage: "Слишком много запросов на обновление alert rule.",
  });

  if (guard.response) {
    return guard.response;
  }

  const { ruleId } = await context.params;
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return privateApiError(400, "Некорректный JSON в запросе.");
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return privateApiError(400, "Проверьте поля alert rule.", {
      code: "invalid_alert_rule_update_payload",
      details: parsed.error.flatten(),
    });
  }

  try {
    const rule = await updateAlertRuleById(
      guard.session!.user.id,
      parsed.data.workspaceId,
      ruleId,
      parsed.data,
    );

    return privateApiJson({ ok: true, rule });
  } catch (error) {
    const message = sanitizeErrorMessage(error, "Не удалось обновить alert rule.");
    const status = message.includes("Недостаточно прав") ? 403 : message.includes("не найден") ? 404 : 400;
    return privateApiError(status, message, {
      code: status === 403 ? "alert_rule_forbidden" : "alert_rule_update_failed",
    });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const guard = await guardSaasApiRequest(request, {
    scope: "saas:alerts:delete",
    rateLimitMessage: "Слишком много запросов на удаление alert rule.",
  });

  if (guard.response) {
    return guard.response;
  }

  const { ruleId } = await context.params;
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return privateApiError(400, "workspaceId обязателен для удаления alert rule.");
  }

  try {
    const result = await deleteAlertRuleById(guard.session!.user.id, workspaceId, ruleId);
    return privateApiJson({ ok: true, result });
  } catch (error) {
    const message = sanitizeErrorMessage(error, "Не удалось удалить alert rule.");
    const status = message.includes("Недостаточно прав") ? 403 : message.includes("не найден") ? 404 : 400;
    return privateApiError(status, message, {
      code: status === 403 ? "alert_rule_forbidden" : "alert_rule_delete_failed",
    });
  }
}
