import { NextRequest } from "next/server";

import { guardSaasApiRequest } from "@/lib/auth/saas-api";
import { isWorkspaceLimitError } from "@/lib/saas/limits";
import { createManualAssetPosition } from "@/lib/saas/manual-assets";
import { manualAssetCreateSchema } from "@/lib/saas/schema";
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

function inferStatus(message: string) {
  if (message.includes("permission")) {
    return 403;
  }

  if (message.includes("not found") || message.includes("archived")) {
    return 404;
  }

  if (message.includes("already exists")) {
    return 409;
  }

  return 400;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const guard = await guardSaasApiRequest(request, {
    scope: "saas:positions:create",
    rateLimitMessage: "Too many manual asset create requests.",
  });

  if (guard.response) {
    return guard.response;
  }

  const { portfolioId } = await context.params;

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return privateApiError(400, "Invalid JSON payload.");
  }

  const parsed = manualAssetCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return privateApiError(400, "Check manual asset fields.", {
      code: "invalid_manual_asset_payload",
      details: parsed.error.flatten(),
    });
  }

  try {
    const result = await createManualAssetPosition(
      guard.session!.user.id,
      portfolioId,
      parsed.data,
    );

    return privateApiJson(
      {
        ok: true,
        result,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = sanitizeErrorMessage(error, "Failed to create manual asset.");
    const status = isWorkspaceLimitError(error) ? 409 : inferStatus(message);

    return privateApiError(status, message, {
      code: status === 409 ? "position_limit_reached" : status === 403 ? "manual_asset_forbidden" : "manual_asset_create_failed",
    });
  }
}