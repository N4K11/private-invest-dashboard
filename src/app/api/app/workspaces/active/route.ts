import { NextRequest } from "next/server";

import { applyActiveWorkspaceCookie } from "@/lib/auth/active-workspace";
import { guardSaasApiRequest } from "@/lib/auth/saas-api";
import { getWorkspaceMembershipBySlugForUser } from "@/lib/auth/workspace";
import { workspaceSelectionSchema } from "@/lib/saas/schema";
import { privateApiError, privateApiJson } from "@/lib/security/http";

export async function POST(request: NextRequest) {
  const guard = await guardSaasApiRequest(request, {
    scope: "saas:workspaces:active",
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

  const parsed = workspaceSelectionSchema.safeParse(payload);
  if (!parsed.success) {
    return privateApiError(400, "Не удалось определить workspace для переключения.", {
      code: "invalid_workspace_selection",
      details: parsed.error.flatten(),
    });
  }

  const membership = await getWorkspaceMembershipBySlugForUser(
    guard.session!.user.id,
    parsed.data.workspaceSlug,
  );

  if (!membership) {
    return privateApiError(404, "Workspace не найден или доступ к нему отсутствует.", {
      code: "workspace_not_found",
    });
  }

  const response = privateApiJson({
    ok: true,
    activeWorkspace: {
      id: membership.workspace.id,
      slug: membership.workspace.slug,
      name: membership.workspace.name,
    },
  });

  return applyActiveWorkspaceCookie(response, membership.workspace.slug);
}
