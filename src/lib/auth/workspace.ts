import "server-only";

import type { WorkspaceRole } from "@prisma/client";

import { getPrismaClient } from "@/lib/db/client";

export type WorkspaceRoleKey = "owner" | "admin" | "member" | "viewer";

type WorkspaceContextOptions = {
  preferredWorkspaceSlug?: string | null;
};

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

function pickActiveMembership<
  T extends {
    role: WorkspaceRole;
    createdAt: Date;
    workspace: { slug: string };
  },
>(
  memberships: T[],
  preferredWorkspaceSlug?: string | null,
) {
  if (preferredWorkspaceSlug) {
    const preferred = memberships.find(
      (membership) => membership.workspace.slug === preferredWorkspaceSlug,
    );

    if (preferred) {
      return preferred;
    }
  }

  return pickPrimaryMembership(memberships);
}

export async function getCurrentUserWorkspaceContext(
  userId: string,
  options: WorkspaceContextOptions = {},
) {
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

  const activeMembership = pickActiveMembership(
    user.memberships,
    options.preferredWorkspaceSlug,
  );

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
      isActive: entry.workspaceId === activeMembership?.workspaceId,
    })),
    primaryWorkspace: activeMembership
      ? {
          id: activeMembership.workspace.id,
          slug: activeMembership.workspace.slug,
          name: activeMembership.workspace.name,
          role: normalizeWorkspaceRole(activeMembership.role),
          defaultCurrency: activeMembership.workspace.defaultCurrency,
          timezone: activeMembership.workspace.timezone,
          memberCount: activeMembership.workspace._count.members,
          portfolioCount: activeMembership.workspace._count.portfolios,
          integrationCount: activeMembership.workspace._count.integrations,
        }
      : null,
  };
}

export async function getWorkspaceMembershipForUser(userId: string, workspaceId: string) {
  const prisma = getPrismaClient();

  return prisma.workspaceMember.findFirst({
    where: {
      userId,
      workspaceId,
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
  });
}

export async function getWorkspaceMembershipBySlugForUser(
  userId: string,
  workspaceSlug: string,
) {
  const prisma = getPrismaClient();

  return prisma.workspaceMember.findFirst({
    where: {
      userId,
      status: "active",
      workspace: {
        slug: workspaceSlug,
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
  });
}

export async function getPortfolioMembershipForUser(userId: string, portfolioId: string) {
  const prisma = getPrismaClient();

  return prisma.workspaceMember.findFirst({
    where: {
      userId,
      status: "active",
      workspace: {
        isArchived: false,
        portfolios: {
          some: {
            id: portfolioId,
            isArchived: false,
          },
        },
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
  });
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
          integrations: true,
        },
      },
    },
  });
}
