import "server-only";

import { Prisma } from "@prisma/client";

import { getWorkspaceMembershipForUser } from "@/lib/auth/workspace";
import { getPrismaClient } from "@/lib/db/client";
import type {
  PortfolioCreateInput,
  WorkspaceCreateInput,
} from "@/lib/saas/schema";
import { getWorkspaceLimitSnapshot } from "@/lib/saas/limits";
import { pricePortfolioPositions } from "@/lib/saas/portfolio-pricing";
import {
  mapVisibilityToPrisma,
  normalizePortfolioVisibility,
} from "@/lib/saas/utils";
import type { SaasPortfolioListItem, SaasWorkspaceLimitSnapshot, SaasWorkspaceOverview } from "@/types/saas";
import { toSlugFragment } from "@/lib/utils";

type WorkspacePortfolioWithMetrics = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  visibility: "PRIVATE" | "SHARED_LINK" | "WORKSPACE";
  baseCurrency: string;
  riskProfile: string | null;
  createdAt: Date;
  updatedAt: Date;
  positions: Parameters<typeof pricePortfolioPositions>[0]["positions"];
  _count: {
    positions: number;
    transactions: number;
    integrations: number;
  };
};

function buildWorkspaceSlug(base: string, attempt: number) {
  return attempt === 0 ? base : `${base}-${attempt + 1}`;
}

async function computePortfolioMetrics(
  portfolio: WorkspacePortfolioWithMetrics,
  limitSnapshot?: SaasWorkspaceLimitSnapshot,
): Promise<SaasPortfolioListItem> {
  const pricedPortfolio = await pricePortfolioPositions({
    portfolioId: portfolio.id,
    workspaceId: portfolio.workspaceId,
    baseCurrency: portfolio.baseCurrency,
    positions: portfolio.positions,
    limitSnapshot,
  });
  const categories = Array.from(
    new Set(pricedPortfolio.positions.map((position) => position.category)),
  );

  return {
    id: portfolio.id,
    workspaceId: portfolio.workspaceId,
    name: portfolio.name,
    slug: portfolio.slug,
    visibility: normalizePortfolioVisibility(portfolio.visibility),
    baseCurrency: portfolio.baseCurrency,
    riskProfile: portfolio.riskProfile,
    createdAt: portfolio.createdAt.toISOString(),
    updatedAt: portfolio.updatedAt.toISOString(),
    positionCount: portfolio._count.positions,
    transactionCount: portfolio._count.transactions,
    integrationCount: portfolio._count.integrations,
    totalValue: pricedPortfolio.totalValue,
    totalCost: pricedPortfolio.totalCost,
    totalPnl: pricedPortfolio.totalPnl,
    categories,
  };
}

export async function createWorkspaceForUser(
  userId: string,
  input: WorkspaceCreateInput,
) {
  const prisma = getPrismaClient();
  const workspaceSlugBase = toSlugFragment(input.name) || "workspace";
  const defaultPortfolio = {
    name: "Р“Р»Р°РІРЅС‹Р№ РїРѕСЂС‚С„РµР»СЊ",
    slug: "main-portfolio",
  } satisfies Pick<PortfolioCreateInput, "name"> & { slug: string };

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const workspaceSlug = buildWorkspaceSlug(workspaceSlugBase, attempt);

    try {
      return await prisma.$transaction(async (transaction) => {
        const workspace = await transaction.workspace.create({
          data: {
            ownerId: userId,
            name: input.name,
            slug: workspaceSlug,
            timezone: input.timezone ?? "UTC",
            defaultCurrency: "USD",
          },
        });

        await transaction.workspaceMember.create({
          data: {
            workspaceId: workspace.id,
            userId,
            role: "OWNER",
            status: "active",
            joinedAt: new Date(),
          },
        });

        const portfolio = await transaction.portfolio.create({
          data: {
            workspaceId: workspace.id,
            name: defaultPortfolio.name,
            slug: defaultPortfolio.slug,
            visibility: mapVisibilityToPrisma("private"),
            baseCurrency: "USD",
            riskProfile: "balanced",
          },
        });

        await transaction.subscription.create({
          data: {
            workspaceId: workspace.id,
            plan: "FREE",
            status: "ACTIVE",
            seatCount: 1,
          },
        });

        await transaction.auditLog.create({
          data: {
            workspaceId: workspace.id,
            portfolioId: portfolio.id,
            userId,
            actorType: "USER",
            action: "workspace.create",
            entityType: "workspace",
            entityId: workspace.id,
            severity: "INFO",
            message: "Created workspace from SaaS management UI.",
            payload: {
              workspaceSlug,
              defaultPortfolioSlug: defaultPortfolio.slug,
            },
          },
        });

        return { workspace, portfolio };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const target = Array.isArray(error.meta?.target)
          ? error.meta.target.join(",")
          : String(error.meta?.target ?? "");

        if (target.includes("slug")) {
          continue;
        }
      }

      throw error;
    }
  }

  throw new Error("РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕРґРѕР±СЂР°С‚СЊ СЃРІРѕР±РѕРґРЅС‹Р№ slug РґР»СЏ РЅРѕРІРѕРіРѕ workspace.");
}

export async function getWorkspaceOverview(
  workspaceId: string,
): Promise<SaasWorkspaceOverview | null> {
  const prisma = getPrismaClient();
  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      isArchived: false,
    },
    include: {
      members: {
        where: {
          status: "active",
        },
      },
      integrations: {
        where: {
          status: {
            not: "DISCONNECTED",
          },
        },
      },
      portfolios: {
        where: {
          isArchived: false,
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        include: {
          positions: {
            include: {
              asset: true,
              integration: {
                select: {
                  name: true,
                },
              },
            },
          },
          _count: {
            select: {
              positions: true,
              transactions: true,
              integrations: true,
            },
          },
        },
      },
      _count: {
        select: {
          members: true,
          portfolios: true,
          integrations: true,
        },
      },
    },
  });

  if (!workspace) {
    return null;
  }

  const limitSnapshot = await getWorkspaceLimitSnapshot(workspaceId);
  const portfolioItems = await Promise.all(
    workspace.portfolios.map((portfolio) => computePortfolioMetrics(portfolio, limitSnapshot ?? undefined)),
  );
  const totalValue = portfolioItems.reduce((sum, item) => sum + item.totalValue, 0);
  const totalCost = portfolioItems.reduce((sum, item) => sum + item.totalCost, 0);
  const positionCount = portfolioItems.reduce((sum, item) => sum + item.positionCount, 0);
  const transactionCount = portfolioItems.reduce(
    (sum, item) => sum + item.transactionCount,
    0,
  );
  const lastActivityAt =
    workspace.portfolios[0]?.updatedAt.toISOString() ?? workspace.updatedAt.toISOString();

  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    workspaceSlug: workspace.slug,
    defaultCurrency: workspace.defaultCurrency,
    timezone: workspace.timezone,
    role: "viewer",
    memberCount: workspace._count.members,
    portfolioCount: workspace._count.portfolios,
    integrationCount: workspace._count.integrations,
    positionCount,
    transactionCount,
    totalValue,
    totalCost,
    totalPnl: totalValue - totalCost,
    lastActivityAt,
    recentPortfolios: portfolioItems.slice(0, 6),
  };
}

export async function listWorkspacePortfoliosForUser(
  userId: string,
  workspaceId: string,
) {
  const membership = await getWorkspaceMembershipForUser(userId, workspaceId);

  if (!membership) {
    return [];
  }

  const prisma = getPrismaClient();
  const portfolios = await prisma.portfolio.findMany({
    where: {
      workspaceId,
      isArchived: false,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      positions: {
        include: {
          asset: true,
          integration: {
            select: {
              name: true,
            },
          },
        },
      },
      _count: {
        select: {
          positions: true,
          transactions: true,
          integrations: true,
        },
      },
    },
  });

  const limitSnapshot = await getWorkspaceLimitSnapshot(workspaceId);
  return Promise.all(
    portfolios.map((portfolio) => computePortfolioMetrics(portfolio, limitSnapshot ?? undefined)),
  );
}

