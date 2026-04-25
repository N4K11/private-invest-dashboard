import "server-only";

import type { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const ACTIVE_WORKSPACE_COOKIE_NAME = "saas_active_workspace";
const ACTIVE_WORKSPACE_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

export async function getActiveWorkspaceSlug() {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_WORKSPACE_COOKIE_NAME)?.value ?? null;
}

export function applyActiveWorkspaceCookie(response: NextResponse, workspaceSlug: string) {
  response.cookies.set({
    name: ACTIVE_WORKSPACE_COOKIE_NAME,
    value: workspaceSlug,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACTIVE_WORKSPACE_COOKIE_MAX_AGE,
  });

  return response;
}

export function clearActiveWorkspaceCookie(response: NextResponse) {
  response.cookies.set({
    name: ACTIVE_WORKSPACE_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
