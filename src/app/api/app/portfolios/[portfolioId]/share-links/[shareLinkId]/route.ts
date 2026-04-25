import { NextRequest } from "next/server";

import { guardSaasApiRequest } from "@/lib/auth/saas-api";
import { revokeShareLinkForPortfolio } from "@/lib/saas/sharing";
import {
  privateApiError,
  privateApiJson,
  sanitizeErrorMessage,
} from "@/lib/security/http";

type RouteContext = {
  params: Promise<{
    portfolioId: string;
    shareLinkId: string;
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

export async function DELETE(request: NextRequest, context: RouteContext) {
  const guard = await guardSaasApiRequest(request, {
    scope: "saas:share-links:revoke",
    rateLimitMessage: "Too many share link revoke requests.",
  });

  if (guard.response) {
    return guard.response;
  }

  const { portfolioId, shareLinkId } = await context.params;

  try {
    const shareLink = await revokeShareLinkForPortfolio(
      guard.session!.user.id,
      portfolioId,
      shareLinkId,
    );

    return privateApiJson({
      ok: true,
      shareLink,
    });
  } catch (error) {
    const message = sanitizeErrorMessage(error, "Failed to revoke share link.");
    return privateApiError(inferStatus(message), message, {
      code: "share_link_revoke_failed",
    });
  }
}