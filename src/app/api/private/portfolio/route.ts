import { type NextRequest } from "next/server";

import { getPortfolioSnapshot } from "@/lib/portfolio/build-portfolio";
import {
  privateApiError,
  privateApiJson,
  sanitizeErrorMessage,
} from "@/lib/security/http";
import { guardPrivateApiRequest } from "@/lib/security/private-route";

export async function GET(request: NextRequest) {
  const blockedResponse = guardPrivateApiRequest(request, {
    scope: "portfolio",
    rateLimitMessage: "Превышен лимит запросов.",
  });

  if (blockedResponse) {
    return blockedResponse;
  }

  try {
    const snapshot = await getPortfolioSnapshot();
    return privateApiJson(snapshot);
  } catch (error) {
    return privateApiError(
      500,
      sanitizeErrorMessage(error, "Не удалось собрать portfolio snapshot."),
    );
  }
}
