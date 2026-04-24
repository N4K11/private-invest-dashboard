import { NextResponse, type NextRequest } from "next/server";

import {
  requestHasDashboardAccess,
  unauthorizedResponse,
} from "@/lib/auth/dashboard-auth";
import { getEnv } from "@/lib/env";
import { applyRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { getAdminWriteStatus } from "@/lib/sheets/writeback";

export async function GET(request: NextRequest) {
  const env = getEnv();
  const ip = getClientIp(request);
  const rateLimit = applyRateLimit(
    `admin-meta:${ip}`,
    env.RATE_LIMIT_MAX_REQUESTS,
    env.RATE_LIMIT_WINDOW_SECONDS * 1000,
  );

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Превышен лимит запросов." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfter),
          "Cache-Control": "no-store",
        },
      },
    );
  }

  if (!requestHasDashboardAccess(request)) {
    return unauthorizedResponse();
  }

  const admin = await getAdminWriteStatus();

  return NextResponse.json(
    { admin },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
