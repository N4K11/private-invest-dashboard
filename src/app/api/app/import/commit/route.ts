import { NextRequest } from "next/server";

import { commitImportToPortfolio } from "@/lib/imports/commit";
import { importCommitRequestSchema } from "@/lib/imports/schema";
import { guardSaasApiRequest } from "@/lib/auth/saas-api";
import {
  privateApiError,
  privateApiJson,
  sanitizeErrorMessage,
} from "@/lib/security/http";

export async function POST(request: NextRequest) {
  const guard = await guardSaasApiRequest(request, {
    scope: "saas:import:commit",
    rateLimitMessage: "Слишком много запросов на запуск импорта.",
  });

  if (guard.response) {
    return guard.response;
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return privateApiError(400, "Некорректный JSON в запросе.");
  }

  const parsed = importCommitRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return privateApiError(400, "Проверьте данные для запуска импорта.", {
      code: "invalid_import_commit_payload",
      details: parsed.error.flatten(),
    });
  }

  try {
    const result = await commitImportToPortfolio(guard.session!.user.id, parsed.data);
    return privateApiJson({ ok: true, result }, { status: 201 });
  } catch (error) {
    const message = sanitizeErrorMessage(error, "Не удалось завершить импорт.");
    const status =
      message.includes("Недостаточно прав")
        ? 403
        : message.includes("не найден")
          ? 404
          : 500;

    return privateApiError(status, message, {
      code: status === 403 ? "import_commit_forbidden" : "import_commit_failed",
    });
  }
}
