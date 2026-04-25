import { NextRequest } from "next/server";

import { guardSaasApiRequest } from "@/lib/auth/saas-api";
import {
  deleteManualAssetPosition,
  updateManualAssetPosition,
} from "@/lib/saas/manual-assets";
import { manualAssetUpdateSchema } from "@/lib/saas/schema";
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

  if (message.includes("not found") || message.includes("archived") || message.includes("removed")) {
    return 404;
  }

  if (message.includes("already") || message.includes("must be")) {
    return 409;
  }

  return 400;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const guard = await guardSaasApiRequest(request, {
    scope: "saas:positions:update",
    rateLimitMessage: "Too many manual asset update requests.",
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

  const parsed = manualAssetUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return privateApiError(400, "Check manual asset fields.", {
      code: "invalid_manual_asset_update_payload",
      details: parsed.error.flatten(),
    });
  }

  try {
    const result = await updateManualAssetPosition(
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
    const message = sanitizeErrorMessage(error, "Failed to update manual asset.");
    const status = inferStatus(message);

    return privateApiError(status, message, {
      code: status === 403 ? "manual_asset_forbidden" : "manual_asset_update_failed",
    });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const guard = await guardSaasApiRequest(request, {
    scope: "saas:positions:delete",
    rateLimitMessage: "Too many manual asset delete requests.",
  });

  if (guard.response) {
    return guard.response;
  }

  const { portfolioId, positionId } = await context.params;

  try {
    const result = await deleteManualAssetPosition(
      guard.session!.user.id,
      portfolioId,
      positionId,
    );

    return privateApiJson({
      ok: true,
      result,
    });
  } catch (error) {
    const message = sanitizeErrorMessage(error, "Failed to delete manual asset.");
    const status = inferStatus(message);

    return privateApiError(status, message, {
      code: status === 403 ? "manual_asset_forbidden" : "manual_asset_delete_failed",
    });
  }
}