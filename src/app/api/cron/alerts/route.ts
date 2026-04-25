import { NextRequest } from "next/server";

import { getEnv } from "@/lib/env";
import { evaluateAlertRulesForWorkspaces } from "@/lib/saas/alerts";
import { privateApiError, privateApiJson } from "@/lib/security/http";

function resolveCronSecret(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return bearer ?? request.headers.get("x-cron-secret")?.trim() ?? null;
}

function ensureCronAuthorized(request: NextRequest) {
  const env = getEnv();
  if (!env.ALERTS_CRON_SECRET) {
    return privateApiError(503, "ALERTS_CRON_SECRET не настроен.", {
      code: "alerts_cron_not_configured",
    });
  }

  if (resolveCronSecret(request) !== env.ALERTS_CRON_SECRET) {
    return privateApiError(401, "Неверный cron secret.", {
      code: "invalid_cron_secret",
    });
  }

  return null;
}

export async function GET(request: NextRequest) {
  const authError = ensureCronAuthorized(request);
  if (authError) {
    return authError;
  }

  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  const summaries = await evaluateAlertRulesForWorkspaces({
    source: "cron",
    workspaceIds: workspaceId ? [workspaceId] : undefined,
  });

  return privateApiJson({ ok: true, summaries });
}

export async function POST(request: NextRequest) {
  const authError = ensureCronAuthorized(request);
  if (authError) {
    return authError;
  }

  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const workspaceIds =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? [
          ...(typeof (payload as { workspaceId?: unknown }).workspaceId === "string"
            ? [(payload as { workspaceId: string }).workspaceId]
            : []),
          ...(((payload as { workspaceIds?: unknown }).workspaceIds as unknown[]) ?? []).filter(
            (value): value is string => typeof value === "string" && value.trim().length > 0,
          ),
        ]
      : undefined;

  const summaries = await evaluateAlertRulesForWorkspaces({
    source: "cron",
    workspaceIds: workspaceIds && workspaceIds.length > 0 ? workspaceIds : undefined,
  });

  return privateApiJson({ ok: true, summaries });
}
