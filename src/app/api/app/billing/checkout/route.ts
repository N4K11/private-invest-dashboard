import { NextRequest } from "next/server";
import { z } from "zod";

import { guardSaasApiRequest } from "@/lib/auth/saas-api";
import { createCheckoutSessionForWorkspace } from "@/lib/saas/billing";
import { privateApiError, privateApiJson, sanitizeErrorMessage } from "@/lib/security/http";

const requestSchema = z.object({
  workspaceId: z.string().trim().min(1, "Workspace id is required."),
  plan: z.enum(["pro", "whale", "team"]),
});

export async function POST(request: NextRequest) {
  const guard = await guardSaasApiRequest(request, {
    scope: "saas:billing:checkout",
    rateLimitMessage: "Слишком много попыток открыть Stripe Checkout.",
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
    return privateApiError(400, "Проверьте поля checkout запроса.", {
      code: "invalid_billing_checkout_payload",
      details: parsed.error.flatten(),
    });
  }

  try {
    const checkout = await createCheckoutSessionForWorkspace({
      userId: guard.session!.user.id,
      workspaceId: parsed.data.workspaceId,
      selectedPlan: parsed.data.plan,
      origin: request.nextUrl.origin,
    });

    return privateApiJson({ ok: true, sessionId: checkout.sessionId, url: checkout.url }, { status: 201 });
  } catch (error) {
    const message = sanitizeErrorMessage(error, "Не удалось создать Stripe Checkout session.");
    const status =
      message.includes("Недостаточно прав")
        ? 403
        : message.includes("не найден")
          ? 404
          : message.includes("уже") || message.includes("Portal")
            ? 409
            : 400;

    return privateApiError(status, message, {
      code: status === 403 ? "billing_checkout_forbidden" : "billing_checkout_failed",
    });
  }
}