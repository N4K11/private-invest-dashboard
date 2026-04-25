import { NextRequest } from "next/server";
import { z } from "zod";

import { guardSaasApiRequest } from "@/lib/auth/saas-api";
import { createAlertRuleForWorkspace } from "@/lib/saas/alerts";
import { alertRuleCreateSchema } from "@/lib/saas/schema";
import { privateApiError, privateApiJson, sanitizeErrorMessage } from "@/lib/security/http";

const requestSchema = alertRuleCreateSchema.extend({
  workspaceId: z.string().trim().min(1, "Workspace id is required."),
});

export async function POST(request: NextRequest) {
  const guard = await guardSaasApiRequest(request, {
    scope: "saas:alerts:create",
    rateLimitMessage: "Слишком много запросов на создание alert rule.",
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

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return privateApiError(400, "Проверьте поля alert rule.", {
      code: "invalid_alert_rule_payload",
      details: parsed.error.flatten(),
    });
  }

  try {
    const rule = await createAlertRuleForWorkspace(
      guard.session!.user.id,
      parsed.data.workspaceId,
      parsed.data,
    );

    return privateApiJson({ ok: true, rule }, { status: 201 });
  } catch (error) {
    const message = sanitizeErrorMessage(error, "Не удалось создать alert rule.");
    const status = message.includes("Недостаточно прав") ? 403 : message.includes("не найден") ? 404 : 400;
    return privateApiError(status, message, {
      code: status === 403 ? "alert_rule_forbidden" : "alert_rule_create_failed",
    });
  }
}
