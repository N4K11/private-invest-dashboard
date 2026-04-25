import "server-only";

import type { WorkspaceRole } from "@prisma/client";

import { getPrismaClient } from "@/lib/db/client";

export type WorkspaceRoleKey = "owner" | "admin" | "member" | "viewer";

const WORKSPACE_ROLE_PRIORITY: Record<WorkspaceRole, number> = {
  OWNER: 0,
  ADMIN: 1,
  MEMBER: 2,
  VIEWER: 3,
};

export function normalizeWorkspaceRole(role: WorkspaceRole): WorkspaceRoleKey {
  return role.toLowerCase() as WorkspaceRoleKey;
}

export function pickPrimaryMembership<T extends { role: WorkspaceRole; createdAt: Date }>(
  memberships: T[],
) {
  return [...memberships].sort((left, right) => {
    const priorityDelta =
      WORKSPACE_ROLE_PRIORITY[left.role] - WORKSPACE_ROLE_PRIORITY[right.role];

    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
  })[0] ?? null;
}

export async function getCurrentUserWorkspaceContext(userId: string) {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        where: {
          status: "active",
          workspace: {
            isArchived: false,
          },
        },
        include: {
          workspace: {
            include: {
              _count: {
                select: {
                  members: true,
                  portfolios: true,
                  integrations: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  const membership = pickPrimaryMembership(user.memberships);

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      timezone: user.timezone,
      locale: user.locale,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    },
    memberships: user.memberships.map((entry) => ({
      workspaceId: entry.workspaceId,
      role: normalizeWorkspaceRole(entry.role),
      workspaceName: entry.workspace.name,
      workspaceSlug: entry.workspace.slug,
      defaultCurrency: entry.workspace.defaultCurrency,
      timezone: entry.workspace.timezone,
      portfolioCount: entry.workspace._count.portfolios,
      memberCount: entry.workspace._count.members,
      integrationCount: entry.workspace._count.integrations,
    })),
    primaryWorkspace: membership
      ? {
          id: membership.workspace.id,
          slug: membership.workspace.slug,
          name: membership.workspace.name,
          role: normalizeWorkspaceRole(membership.role),
          defaultCurrency: membership.workspace.defaultCurrency,
          timezone: membership.workspace.timezone,
          memberCount: membership.workspace._count.members,
          portfolioCount: membership.workspace._count.portfolios,
          integrationCount: membership.workspace._count.integrations,
        }
      : null,
  };
}

export async function getWorkspacePortfolios(workspaceId: string) {
  const prisma = getPrismaClient();

  return prisma.portfolio.findMany({
    where: {
      workspaceId,
      isArchived: false,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      _count: {
        select: {
          positions: true,
          transactions: true,
          priceSnapshots: true,
        },
      },
    },
  });
}
