import { NextResponse, type NextRequest } from "next/server";

import {
  requestHasDashboardAccess,
  unauthorizedResponse,
} from "@/lib/auth/dashboard-auth";
import { getEnv } from "@/lib/env";
import { getPortfolioSnapshot } from "@/lib/portfolio/build-portfolio";
import { applyRateLimit, getClientIp } from "@/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  const env = getEnv();
  const ip = getClientIp(request);
  const rateLimit = applyRateLimit(
    `portfolio:${ip}`,
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

  const snapshot = await getPortfolioSnapshot();

  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
