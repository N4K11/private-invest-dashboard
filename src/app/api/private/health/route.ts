import { type NextRequest } from "next/server";

import { getDashboardHealthSnapshot } from "@/lib/health/dashboard-health";
import {
  privateApiError,
  privateApiJson,
  sanitizeErrorMessage,
} from "@/lib/security/http";
import { guardPrivateApiRequest } from "@/lib/security/private-route";

export async function GET(request: NextRequest) {
  const blockedResponse = guardPrivateApiRequest(request, {
    scope: "health",
    rateLimitMessage: "Превышен лимит запросов к health page.",
  });

  if (blockedResponse) {
    return blockedResponse;
  }

  try {
    const health = await getDashboardHealthSnapshot();
    return privateApiJson(health);
  } catch (error) {
    return privateApiError(
      500,
      sanitizeErrorMessage(error, "Не удалось собрать health snapshot."),
    );
  }
}
