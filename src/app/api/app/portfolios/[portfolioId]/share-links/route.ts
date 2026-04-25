import { NextRequest } from "next/server";

import { guardSaasApiRequest } from "@/lib/auth/saas-api";
import { createShareLinkForPortfolio } from "@/lib/saas/sharing";
import { shareLinkCreateSchema } from "@/lib/saas/schema";
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

  if (message.includes("not found")) {
    return 404;
  }

  return 400;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const guard = await guardSaasApiRequest(request, {
    scope: "saas:share-links:create",
    rateLimitMessage: "Too many share link create requests.",
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

  const parsed = shareLinkCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return privateApiError(400, "Check share link fields.", {
      code: "invalid_share_link_payload",
      details: parsed.error.flatten(),
    });
  }

  try {
    const shareLink = await createShareLinkForPortfolio(
      guard.session!.user.id,
      portfolioId,
      parsed.data,
    );

    return privateApiJson(
      {
        ok: true,
        shareLink,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = sanitizeErrorMessage(error, "Failed to create share link.");
    return privateApiError(inferStatus(message), message, {
      code: "share_link_create_failed",
    });
  }
}