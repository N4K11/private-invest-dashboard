import { createHash, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import {
  DASHBOARD_BASE_PATH,
  DASHBOARD_COOKIE_NAME,
} from "@/lib/constants";
import { getEnv, isDashboardConfigured } from "@/lib/env";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function secureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function getSessionFingerprint() {
  const env = getEnv();
  if (!env.DASHBOARD_SECRET_TOKEN) {
    return "";
  }

  return hashValue(`dashboard-session:${env.DASHBOARD_SECRET_TOKEN}`);
}

export function getDashboardRoutePath(slug = getEnv().PRIVATE_DASHBOARD_SLUG) {
  return `/${DASHBOARD_BASE_PATH}/${slug}`;
}

export function isValidDashboardToken(token?: string | null) {
  const env = getEnv();
  if (!isDashboardConfigured() || !token) {
    return false;
  }

  return secureEqual(token.trim(), env.DASHBOARD_SECRET_TOKEN);
}

export function hasValidDashboardSession(cookieValue?: string | null) {
  const fingerprint = getSessionFingerprint();
  if (!cookieValue || !fingerprint) {
    return false;
  }

  return secureEqual(cookieValue, fingerprint);
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.replace("Bearer ", "").trim();
}

export function getRequestedDashboardToken(request: NextRequest) {
  return (
    request.nextUrl.searchParams.get("token") ??
    request.headers.get("x-dashboard-token") ??
    getBearerToken(request)
  );
}

export function requestHasDashboardAccess(request: NextRequest) {
  return Boolean(
    isValidDashboardToken(getRequestedDashboardToken(request)) ||
      hasValidDashboardSession(request.cookies.get(DASHBOARD_COOKIE_NAME)?.value),
  );
}

export function setDashboardSessionCookie(response: NextResponse) {
  const env = getEnv();

  response.cookies.set({
    name: DASHBOARD_COOKIE_NAME,
    value: getSessionFingerprint(),
    httpOnly: true,
    sameSite: "strict",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return response;
}

export function clearDashboardSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: DASHBOARD_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: getEnv().NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}

export async function getDashboardAccess(searchToken?: string | string[]) {
  const resolvedToken = Array.isArray(searchToken) ? searchToken[0] : searchToken;
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(DASHBOARD_COOKIE_NAME)?.value;

  return {
    configured: isDashboardConfigured(),
    authorized:
      isValidDashboardToken(resolvedToken) || hasValidDashboardSession(sessionCookie),
    routePath: getDashboardRoutePath(),
  };
}

export function sanitizeRedirectPath(redirectTo?: string | null) {
  if (!redirectTo || !redirectTo.startsWith(`/${DASHBOARD_BASE_PATH}/`)) {
    return getDashboardRoutePath();
  }

  return redirectTo;
}

export function unauthorizedResponse(message = "Unauthorized", status = 401) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
