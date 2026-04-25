import { NextRequest } from "next/server";

import { guardSaasApiRequest } from "@/lib/auth/saas-api";
import { telegramGiftPriceUpdateSchema } from "@/lib/saas/schema";
import { updateTelegramGiftPrice } from "@/lib/saas/telegram-gift-pricing";
import {
  privateApiError,
  privateApiJson,
  sanitizeErrorMessage,
} from "@/lib/security/http";

type RouteContext = {
  params: Promise<{
    portfolioId: string;
    positionId: string;
  }>;
};

function inferStatus(message: string) {
  if (message.includes("permission")) {
    return 403;
  }

  if (message.includes("not found") || message.includes("removed") || message.includes("archived")) {
    return 404;
  }

  if (message.includes("only for Telegram")) {
    return 409;
  }

  return 400;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const guard = await guardSaasApiRequest(request, {
    scope: "saas:telegram-price:update",
    rateLimitMessage: "Too many Telegram gift price update requests.",
  });

  if (guard.response) {
    return guard.response;
  }

  const { portfolioId, positionId } = await context.params;

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return privateApiError(400, "Invalid JSON payload.");
  }

  const parsed = telegramGiftPriceUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return privateApiError(400, "Check Telegram price update fields.", {
      code: "invalid_telegram_price_update_payload",
      details: parsed.error.flatten(),
    });
  }

  try {
    const result = await updateTelegramGiftPrice(
      guard.session!.user.id,
      portfolioId,
      positionId,
      parsed.data,
    );

    return privateApiJson({
      ok: true,
      result,
    });
  } catch (error) {
    const message = sanitizeErrorMessage(error, "Failed to update Telegram Gift price.");
    const status = inferStatus(message);

    return privateApiError(status, message, {
      code: status === 403 ? "telegram_price_update_forbidden" : "telegram_price_update_failed",
    });
  }
}
