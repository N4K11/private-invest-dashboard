import { NextRequest } from "next/server";
import { z } from "zod";

import { guardSaasApiRequest } from "@/lib/auth/saas-api";
import { createCustomerPortalSessionForWorkspace } from "@/lib/saas/billing";
import { privateApiError, privateApiJson, sanitizeErrorMessage } from "@/lib/security/http";

const requestSchema = z.object({
  workspaceId: z.string().trim().min(1, "Workspace id is required."),
});

export async function POST(request: NextRequest) {
  const guard = await guardSaasApiRequest(request, {
    scope: "saas:billing:portal",
    rateLimitMessage: "Слишком много попыток открыть Customer Portal.",
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
    return privateApiError(400, "Проверьте поля Customer Portal запроса.", {
      code: "invalid_billing_portal_payload",
      details: parsed.error.flatten(),
    });
  }

  try {
    const session = await createCustomerPortalSessionForWorkspace({
      userId: guard.session!.user.id,
      workspaceId: parsed.data.workspaceId,
      origin: request.nextUrl.origin,
    });

    return privateApiJson({ ok: true, sessionId: session.sessionId, url: session.url }, { status: 201 });
  } catch (error) {
    const message = sanitizeErrorMessage(error, "Не удалось открыть Stripe Customer Portal.");
    const status =
      message.includes("Недостаточно прав")
        ? 403
        : message.includes("не найден")
          ? 404
          : 400;

    return privateApiError(status, message, {
      code: status === 403 ? "billing_portal_forbidden" : "billing_portal_failed",
    });
  }
}