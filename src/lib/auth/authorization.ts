import "server-only";

import type { WorkspaceRoleKey } from "@/lib/auth/workspace";

export function canCreateWorkspace() {
  return true;
}

export function canManageWorkspace(role: WorkspaceRoleKey | null | undefined) {
  return role === "owner" || role === "admin";
}

export function canManagePortfolio(role: WorkspaceRoleKey | null | undefined) {
  return role === "owner" || role === "admin";
}

export function canArchivePortfolio(role: WorkspaceRoleKey | null | undefined) {
  return role === "owner" || role === "admin";
}
