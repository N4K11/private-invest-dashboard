import { NextRequest } from "next/server";

import { handleStripeWebhookRequest } from "@/lib/saas/billing";
import { privateApiError, privateApiJson, sanitizeErrorMessage } from "@/lib/security/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  try {
    const result = await handleStripeWebhookRequest(payload, signature);

    return privateApiJson({
      ok: true,
      received: true,
      eventId: result.eventId,
      eventType: result.eventType,
      handled: result.handled,
      workspaceId: result.workspaceId,
      reason: result.reason,
    });
  } catch (error) {
    return privateApiError(400, sanitizeErrorMessage(error, "Stripe webhook rejected."), {
      code: "stripe_webhook_failed",
    });
  }
}