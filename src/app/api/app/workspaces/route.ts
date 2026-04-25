import { NextRequest } from "next/server";

import { canCreateWorkspace } from "@/lib/auth/authorization";
import { applyActiveWorkspaceCookie } from "@/lib/auth/active-workspace";
import { guardSaasApiRequest } from "@/lib/auth/saas-api";
import { createWorkspaceForUser } from "@/lib/saas/workspaces";
import { workspaceCreateSchema } from "@/lib/saas/schema";
import {
  privateApiError,
  privateApiJson,
  sanitizeErrorMessage,
} from "@/lib/security/http";

export async function POST(request: NextRequest) {
  const guard = await guardSaasApiRequest(request, {
    scope: "saas:workspaces:create",
    rateLimitMessage: "Слишком много запросов на создание workspace.",
  });

  if (guard.response) {
    return guard.response;
  }

  if (!canCreateWorkspace()) {
    return privateApiError(403, "Создание workspace отключено для этого режима.");
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return privateApiError(400, "Некорректный JSON в запросе.");
  }

  const parsed = workspaceCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return privateApiError(400, "Проверьте поля создания workspace.", {
      code: "invalid_workspace_payload",
      details: parsed.error.flatten(),
    });
  }

  try {
    const result = await createWorkspaceForUser(guard.session!.user.id, parsed.data);
    const response = privateApiJson(
      {
        ok: true,
        workspace: {
          id: result.workspace.id,
          name: result.workspace.name,
          slug: result.workspace.slug,
          timezone: result.workspace.timezone,
          defaultCurrency: result.workspace.defaultCurrency,
        },
        portfolio: {
          id: result.portfolio.id,
          name: result.portfolio.name,
          slug: result.portfolio.slug,
        },
      },
      { status: 201 },
    );

    return applyActiveWorkspaceCookie(response, result.workspace.slug);
  } catch (error) {
    return privateApiError(
      500,
      sanitizeErrorMessage(error, "Не удалось создать новый workspace."),
      { code: "workspace_create_failed" },
    );
  }
}
