import { type NextRequest } from "next/server";
import { ZodError } from "zod";

import { adminPortfolioSnapshotMutationSchema } from "@/lib/admin/schema";
import { getEnv } from "@/lib/env";
import {
  privateApiError,
  privateApiJson,
  sanitizeErrorMessage,
} from "@/lib/security/http";
import { guardPrivateApiRequest } from "@/lib/security/private-route";
import {
  applyPortfolioSnapshotMutation,
  SnapshotConflictError,
} from "@/lib/sheets/writeback";

function getValidationErrors(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

export async function POST(request: NextRequest) {
  const env = getEnv();
  const blockedResponse = guardPrivateApiRequest(request, {
    scope: "admin-write:snapshots",
    maxRequests: Math.max(6, Math.floor(env.RATE_LIMIT_MAX_REQUESTS / 2)),
    rateLimitMessage: "Превышен лимит запросов на создание snapshot.",
  });

  if (blockedResponse) {
    return blockedResponse;
  }

  try {
    const rawPayload = await request.json().catch(() => null);
    const payload = adminPortfolioSnapshotMutationSchema.parse(rawPayload);
    const result = await applyPortfolioSnapshotMutation(payload);

    return privateApiJson({
      ok: true,
      result,
    });
  } catch (error) {
    if (error instanceof SnapshotConflictError) {
      return privateApiError(409, error.message, {
        code: "snapshot_exists",
        extraBody: {
          conflict: {
            date: error.date,
            rowNumber: error.rowNumber,
            sheetName: error.sheetName,
          },
        },
      });
    }

    if (error instanceof ZodError) {
      return privateApiError(400, "Некорректный payload snapshot.", {
        details: getValidationErrors(error),
      });
    }

    return privateApiError(
      500,
      sanitizeErrorMessage(error, "Не удалось создать snapshot в Portfolio_History."),
    );
  }
}
