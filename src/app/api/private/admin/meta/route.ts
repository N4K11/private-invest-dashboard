import { type NextRequest } from "next/server";

import { getAdminWriteStatus } from "@/lib/sheets/writeback";
import {
  privateApiError,
  privateApiJson,
  sanitizeErrorMessage,
} from "@/lib/security/http";
import { guardPrivateApiRequest } from "@/lib/security/private-route";

export async function GET(request: NextRequest) {
  const blockedResponse = guardPrivateApiRequest(request, {
    scope: "admin-meta",
    rateLimitMessage: "Превышен лимит запросов.",
  });

  if (blockedResponse) {
    return blockedResponse;
  }

  try {
    const admin = await getAdminWriteStatus();
    return privateApiJson({ admin });
  } catch (error) {
    return privateApiError(
      500,
      sanitizeErrorMessage(error, "Не удалось получить статус admin mode."),
    );
  }
}
