import { NextRequest } from "next/server";

import { commitImportToPortfolio } from "@/lib/imports/commit";
import { importCommitRequestSchema } from "@/lib/imports/schema";
import { isWorkspaceLimitError } from "@/lib/saas/limits";
import { guardSaasApiRequest } from "@/lib/auth/saas-api";
import {
  privateApiError,
  privateApiJson,
  sanitizeErrorMessage,
} from "@/lib/security/http";

export async function POST(request: NextRequest) {
  const guard = await guardSaasApiRequest(request, {
    scope: "saas:import:commit",
    rateLimitMessage: "Р РЋР В»Р С‘РЎв‚¬Р С”Р С•Р С Р СР Р…Р С•Р С–Р С• Р В·Р В°Р С—РЎР‚Р С•РЎРѓР С•Р Р† Р Р…Р В° Р В·Р В°Р С—РЎС“РЎРѓР С” Р С‘Р СР С—Р С•РЎР‚РЎвЂљР В°.",
  });

  if (guard.response) {
    return guard.response;
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return privateApiError(400, "Р СњР ВµР С”Р С•РЎР‚РЎР‚Р ВµР С”РЎвЂљР Р…РЎвЂ№Р в„– JSON Р Р† Р В·Р В°Р С—РЎР‚Р С•РЎРѓР Вµ.");
  }

  const parsed = importCommitRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return privateApiError(400, "Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЉРЎвЂљР Вµ Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р Вµ Р Т‘Р В»РЎРЏ Р В·Р В°Р С—РЎС“РЎРѓР С”Р В° Р С‘Р СР С—Р С•РЎР‚РЎвЂљР В°.", {
      code: "invalid_import_commit_payload",
      details: parsed.error.flatten(),
    });
  }

  try {
    const result = await commitImportToPortfolio(guard.session!.user.id, parsed.data);
    return privateApiJson({ ok: true, result }, { status: 201 });
  } catch (error) {
    const message = sanitizeErrorMessage(error, "Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р В·Р В°Р Р†Р ВµРЎР‚РЎв‚¬Р С‘РЎвЂљРЎРЉ Р С‘Р СР С—Р С•РЎР‚РЎвЂљ.");
    const status =
      isWorkspaceLimitError(error)
        ? 409
        : message.includes("Недостаточно прав")
          ? 403
          : message.includes("не найден")
            ? 404
            : 500;

    return privateApiError(status, message, {
      code: status === 409 ? "position_limit_reached" : status === 403 ? "import_commit_forbidden" : "import_commit_failed",
    });
  }
}
