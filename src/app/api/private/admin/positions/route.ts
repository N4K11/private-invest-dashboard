import { type NextRequest } from "next/server";
import { ZodError } from "zod";

import { adminMutationSchema } from "@/lib/admin/schema";
import { getEnv } from "@/lib/env";
import {
  privateApiError,
  privateApiJson,
  sanitizeErrorMessage,
} from "@/lib/security/http";
import { guardPrivateApiRequest } from "@/lib/security/private-route";
import { applyAdminMutation } from "@/lib/sheets/writeback";

function getValidationErrors(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

export async function POST(request: NextRequest) {
  const env = getEnv();
  const blockedResponse = guardPrivateApiRequest(request, {
    scope: "admin-write",
    maxRequests: Math.max(8, Math.floor(env.RATE_LIMIT_MAX_REQUESTS / 2)),
    rateLimitMessage: "Превышен лимит запросов на запись.",
  });

  if (blockedResponse) {
    return blockedResponse;
  }

  try {
    const rawPayload = await request.json().catch(() => null);
    const payload = adminMutationSchema.parse(rawPayload);
    const result = await applyAdminMutation(payload);

    return privateApiJson({
      ok: true,
      result,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return privateApiError(400, "Некорректный payload admin mode.", {
        details: getValidationErrors(error),
      });
    }

    return privateApiError(
      500,
      sanitizeErrorMessage(error, "Не удалось сохранить изменения в Google Sheets."),
    );
  }
}
