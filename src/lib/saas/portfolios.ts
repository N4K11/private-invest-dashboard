import "server-only";

import { Prisma } from "@prisma/client";

import {
  canArchivePortfolio,
  canManagePortfolio,
} from "@/lib/auth/authorization";
import {
  getPortfolioMembershipForUser,
  getWorkspaceMembershipForUser,
  normalizeWorkspaceRole,
} from "@/lib/auth/workspace";
import { CATEGORY_META } from "@/lib/constants";
import { getPrismaClient } from "@/lib/db/client";
import { buildSaasPortfolioAnalytics } from "@/lib/saas/portfolio-analytics";
import { buildPortfolioInsights } from "@/lib/saas/portfolio-insights";
import { getManualStaleAfterMs, isTimestampStale } from "@/lib/saas/price-engine/utils";
import type {
  PortfolioCreateInput,
  PortfolioUpdateInput,
} from "@/lib/saas/schema";
import {
  pricePortfolioPositions,
  type PortfolioPositionForPricing,
} from "@/lib/saas/portfolio-pricing";
import {
  buildTelegramGiftPricingRow,
  extractTelegramPriceUpdateHistoryRow,
} from "@/lib/saas/telegram-gift-pricing";
import {
  decimalToNumber,
  mapVisibilityToPrisma,
  normalizePortfolioVisibility,
} from "@/lib/saas/utils";
import type {
  SaasAssetCategory,
  SaasPortfolioDetail,
  SaasPortfolioListItem,
  SaasPortfolioTransactionRow,
} from "@/types/saas";
import { toSlugFragment } from "@/lib/utils";

const EXTRA_CATEGORY_META: Record<"custom" | "nft", { label: string; color: string }> = {
  custom: {
    label: "Custom",
    color: "#94a3b8",
  },
  nft: {
    label: "NFT",
    color: "#fb923c",
  },
};

type PortfolioWithMetrics = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  visibility: "PRIVATE" | "SHARED_LINK" | "WORKSPACE";
  baseCurrency: string;
  riskProfile: string | null;
  createdAt: Date;
  updatedAt: Date;
  positions: PortfolioPositionForPricing[];
  _count: {
    positions: number;
    transactions: number;
    integrations: number;
  };
};

function buildPortfolioSlug(base: string, attempt: number) {
  return attempt === 0 ? base : `${base}-${attempt + 1}`;
}

function getCategoryMeta(category: "cs2" | "telegram" | "crypto" | "custom" | "nft") {
  if (category === "custom" || category === "nft") {
    return EXTRA_CATEGORY_META[category];
  }

  return CATEGORY_META[category];
}

async function computePortfolioListItem(
  portfolio: PortfolioWithMetrics,
): Promise<SaasPortfolioListItem> {
  const pricedPortfolio = await pricePortfolioPositions({
    portfolioId: portfolio.id,
    baseCurrency: portfolio.baseCurrency,
    positions: portfolio.positions,
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
    updatedAt: portfolio.updatedAt.toISOString(),
    createdAt: portfolio.createdAt.toISOString(),
    positionCount: portfolio._count.positions,
    transactionCount: portfolio._count.transactions,
    integrationCount: portfolio._count.integrations,
    totalValue: pricedPortfolio.totalValue,
    totalCost: pricedPortfolio.totalCost,
    totalPnl: pricedPortfolio.totalPnl,
    categories,
  };
}

export async function createPortfolioForWorkspace(
  userId: string,
  workspaceId: string,
  input: PortfolioCreateInput,
) {
  const membership = await getWorkspaceMembershipForUser(userId, workspaceId);

  if (!membership) {
    throw new Error("Workspace Р В Р вЂ¦Р В Р’Вµ Р В Р вЂ¦Р В Р’В°Р В РІвЂћвЂ“Р В РўвЂР В Р’ВµР В Р вЂ¦ Р В РЎвЂР В Р’В»Р В РЎвЂ Р В РўвЂР В РЎвЂўР РЋР С“Р РЋРІР‚С™Р РЋРЎвЂњР В РЎвЂ” Р В РЎвЂќ Р В Р вЂ¦Р В Р’ВµР В РЎВР РЋРЎвЂњ Р В РЎвЂ”Р В РЎвЂўР РЋРІР‚С™Р В Р’ВµР РЋР вЂљР РЋР РЏР В Р вЂ¦.");
  }

  const role = normalizeWorkspaceRole(membership.role);
  if (!canManagePortfolio(role)) {
    throw new Error("Р В РЎСљР В Р’ВµР В РўвЂР В РЎвЂўР РЋР С“Р РЋРІР‚С™Р В Р’В°Р РЋРІР‚С™Р В РЎвЂўР РЋРІР‚РЋР В Р вЂ¦Р В РЎвЂў Р В РЎвЂ”Р РЋР вЂљР В Р’В°Р В Р вЂ  Р В РўвЂР В Р’В»Р РЋР РЏ Р РЋР С“Р В РЎвЂўР В Р’В·Р В РўвЂР В Р’В°Р В Р вЂ¦Р В РЎвЂР РЋР РЏ Р В РЎвЂ”Р В РЎвЂўР РЋР вЂљР РЋРІР‚С™Р РЋРІР‚С›Р В Р’ВµР В Р’В»Р РЋР РЏ Р В Р вЂ  Р РЋР РЉР РЋРІР‚С™Р В РЎвЂўР В РЎВ workspace.");
  }

  const prisma = getPrismaClient();
  const slugBase = toSlugFragment(input.name) || "portfolio";

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const slug = buildPortfolioSlug(slugBase, attempt);

    try {
      return await prisma.$transaction(async (transaction) => {
        const portfolio = await transaction.portfolio.create({
          data: {
            workspaceId,
            name: input.name,
            slug,
            visibility: mapVisibilityToPrisma(input.visibility),
            baseCurrency: input.baseCurrency,
            riskProfile: input.riskProfile,
          },
        });

        await transaction.auditLog.create({
          data: {
            workspaceId,
            portfolioId: portfolio.id,
            userId,
            actorType: "USER",
            action: "portfolio.create",
            entityType: "portfolio",
            entityId: portfolio.id,
            severity: "INFO",
            message: "Created portfolio from SaaS management UI.",
            payload: {
              slug,
              visibility: input.visibility,
              baseCurrency: input.baseCurrency,
              riskProfile: input.riskProfile,
            },
          },
        });

        return portfolio;
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

  throw new Error("Р В РЎСљР В Р’Вµ Р РЋРЎвЂњР В РўвЂР В Р’В°Р В Р’В»Р В РЎвЂўР РЋР С“Р РЋР Р‰ Р В РЎвЂ”Р В РЎвЂўР В РўвЂР В РЎвЂўР В Р’В±Р РЋР вЂљР В Р’В°Р РЋРІР‚С™Р РЋР Р‰ Р РЋР С“Р В Р вЂ Р В РЎвЂўР В Р’В±Р В РЎвЂўР В РўвЂР В Р вЂ¦Р РЋРІР‚в„–Р В РІвЂћвЂ“ slug Р В РўвЂР В Р’В»Р РЋР РЏ Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В РЎвЂўР В РЎвЂ“Р В РЎвЂў Р В РЎвЂ”Р В РЎвЂўР РЋР вЂљР РЋРІР‚С™Р РЋРІР‚С›Р В Р’ВµР В Р’В»Р РЋР РЏ.");
}

export async function updatePortfolioById(
  userId: string,
  portfolioId: string,
  input: PortfolioUpdateInput,
) {
  const membership = await getPortfolioMembershipForUser(userId, portfolioId);

  if (!membership) {
    throw new Error("Р В РЎСџР В РЎвЂўР РЋР вЂљР РЋРІР‚С™Р РЋРІР‚С›Р В Р’ВµР В Р’В»Р РЋР Р‰ Р В Р вЂ¦Р В Р’Вµ Р В Р вЂ¦Р В Р’В°Р В РІвЂћвЂ“Р В РўвЂР В Р’ВµР В Р вЂ¦ Р В РЎвЂР В Р’В»Р В РЎвЂ Р В РўвЂР В РЎвЂўР РЋР С“Р РЋРІР‚С™Р РЋРЎвЂњР В РЎвЂ” Р В РЎвЂќ Р В Р вЂ¦Р В Р’ВµР В РЎВР РЋРЎвЂњ Р В РЎвЂўР РЋРІР‚С™Р РЋР С“Р РЋРЎвЂњР РЋРІР‚С™Р РЋР С“Р РЋРІР‚С™Р В Р вЂ Р РЋРЎвЂњР В Р’ВµР РЋРІР‚С™.");
  }

  const role = normalizeWorkspaceRole(membership.role);
  if (!canManagePortfolio(role)) {
    throw new Error("Р В РЎСљР В Р’ВµР В РўвЂР В РЎвЂўР РЋР С“Р РЋРІР‚С™Р В Р’В°Р РЋРІР‚С™Р В РЎвЂўР РЋРІР‚РЋР В Р вЂ¦Р В РЎвЂў Р В РЎвЂ”Р РЋР вЂљР В Р’В°Р В Р вЂ  Р В РўвЂР В Р’В»Р РЋР РЏ Р РЋР вЂљР В Р’ВµР В РўвЂР В Р’В°Р В РЎвЂќР РЋРІР‚С™Р В РЎвЂР РЋР вЂљР В РЎвЂўР В Р вЂ Р В Р’В°Р В Р вЂ¦Р В РЎвЂР РЋР РЏ Р В РЎвЂ”Р В РЎвЂўР РЋР вЂљР РЋРІР‚С™Р РЋРІР‚С›Р В Р’ВµР В Р’В»Р РЋР РЏ.");
  }

  const prisma = getPrismaClient();
  const portfolio = await prisma.portfolio.update({
    where: {
      id: portfolioId,
    },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.baseCurrency ? { baseCurrency: input.baseCurrency } : {}),
      ...(input.visibility ? { visibility: mapVisibilityToPrisma(input.visibility) } : {}),
      ...(input.riskProfile ? { riskProfile: input.riskProfile } : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: membership.workspaceId,
      portfolioId: portfolio.id,
      userId,
      actorType: "USER",
      action: "portfolio.update",
      entityType: "portfolio",
      entityId: portfolio.id,
      severity: "INFO",
      message: "Updated portfolio settings from SaaS management UI.",
      payload: input,
    },
  });

  return portfolio;
}

export async function archivePortfolioById(userId: string, portfolioId: string) {
  const membership = await getPortfolioMembershipForUser(userId, portfolioId);

  if (!membership) {
    throw new Error("Р В РЎСџР В РЎвЂўР РЋР вЂљР РЋРІР‚С™Р РЋРІР‚С›Р В Р’ВµР В Р’В»Р РЋР Р‰ Р В Р вЂ¦Р В Р’Вµ Р В Р вЂ¦Р В Р’В°Р В РІвЂћвЂ“Р В РўвЂР В Р’ВµР В Р вЂ¦ Р В РЎвЂР В Р’В»Р В РЎвЂ Р В РўвЂР В РЎвЂўР РЋР С“Р РЋРІР‚С™Р РЋРЎвЂњР В РЎвЂ” Р В РЎвЂќ Р В Р вЂ¦Р В Р’ВµР В РЎВР РЋРЎвЂњ Р В РЎвЂўР РЋРІР‚С™Р РЋР С“Р РЋРЎвЂњР РЋРІР‚С™Р РЋР С“Р РЋРІР‚С™Р В Р вЂ Р РЋРЎвЂњР В Р’ВµР РЋРІР‚С™.");
  }

  const role = normalizeWorkspaceRole(membership.role);
  if (!canArchivePortfolio(role)) {
    throw new Error("Р В РЎСљР В Р’ВµР В РўвЂР В РЎвЂўР РЋР С“Р РЋРІР‚С™Р В Р’В°Р РЋРІР‚С™Р В РЎвЂўР РЋРІР‚РЋР В Р вЂ¦Р В РЎвЂў Р В РЎвЂ”Р РЋР вЂљР В Р’В°Р В Р вЂ  Р В РўвЂР В Р’В»Р РЋР РЏ Р РЋРЎвЂњР В РўвЂР В Р’В°Р В Р’В»Р В Р’ВµР В Р вЂ¦Р В РЎвЂР РЋР РЏ Р В РЎвЂ”Р В РЎвЂўР РЋР вЂљР РЋРІР‚С™Р РЋРІР‚С›Р В Р’ВµР В Р’В»Р РЋР РЏ.");
  }

  const prisma = getPrismaClient();

  const remainingPortfolios = await prisma.portfolio.count({
    where: {
      workspaceId: membership.workspaceId,
      isArchived: false,
    },
  });

  if (remainingPortfolios <= 1) {
    throw new Error("Р В РЎСљР В Р’ВµР В Р’В»Р РЋР Р‰Р В Р’В·Р РЋР РЏ Р В Р’В°Р РЋР вЂљР РЋРІР‚В¦Р В РЎвЂР В Р вЂ Р В РЎвЂР РЋР вЂљР В РЎвЂўР В Р вЂ Р В Р’В°Р РЋРІР‚С™Р РЋР Р‰ Р В РЎвЂ”Р В РЎвЂўР РЋР С“Р В Р’В»Р В Р’ВµР В РўвЂР В Р вЂ¦Р В РЎвЂР В РІвЂћвЂ“ Р В РЎвЂ”Р В РЎвЂўР РЋР вЂљР РЋРІР‚С™Р РЋРІР‚С›Р В Р’ВµР В Р’В»Р РЋР Р‰ workspace.");
  }

  const portfolio = await prisma.portfolio.update({
    where: {
      id: portfolioId,
    },
    data: {
      isArchived: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: membership.workspaceId,
      portfolioId: portfolio.id,
      userId,
      actorType: "USER",
      action: "portfolio.archive",
      entityType: "portfolio",
      entityId: portfolio.id,
      severity: "WARNING",
      message: "Archived portfolio from SaaS management UI.",
    },
  });

  return portfolio;
}

export async function getPortfolioDetailForUser(
  userId: string,
  portfolioId: string,
): Promise<SaasPortfolioDetail | null> {
  const membership = await getPortfolioMembershipForUser(userId, portfolioId);

  if (!membership) {
    return null;
  }

  const prisma = getPrismaClient();
  const portfolio = await prisma.portfolio.findFirst({
    where: {
      id: portfolioId,
      workspaceId: membership.workspaceId,
      isArchived: false,
    },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      positions: {
        orderBy: [{ updatedAt: "desc" }],
        include: {
          asset: true,
          integration: {
            select: {
              name: true,
            },
          },
        },
      },
      transactions: {
        take: 8,
        orderBy: [{ occurredAt: "desc" }],
        include: {
          asset: {
            select: {
              name: true,
              category: true,
            },
          },
        },
      },
      integrations: {
        orderBy: [{ updatedAt: "desc" }],
        select: {
          id: true,
          name: true,
          type: true,
          mode: true,
          status: true,
          lastSyncedAt: true,
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

  if (!portfolio) {
    return null;
  }

  const role = normalizeWorkspaceRole(membership.role);
  const canManage = canManagePortfolio(role);
  const pricedPortfolio = await pricePortfolioPositions({
    portfolioId: portfolio.id,
    baseCurrency: portfolio.baseCurrency,
    positions: portfolio.positions,
  });
  const positions = pricedPortfolio.positions;
  const totalValue = pricedPortfolio.totalValue;
  const totalCost = pricedPortfolio.totalCost;
  const totalPnl = pricedPortfolio.totalPnl;
  const roi = totalCost > 0 ? (totalPnl / totalCost) * 100 : null;

  const [analyticsTransactions, analyticsSnapshots] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        portfolioId: portfolio.id,
      },
      orderBy: [{ occurredAt: "asc" }],
      select: {
        assetId: true,
        action: true,
        occurredAt: true,
        quantity: true,
        unitPrice: true,
        fees: true,
      },
    }),
    prisma.priceSnapshot.findMany({
      where: {
        portfolioId: portfolio.id,
      },
      orderBy: [{ capturedAt: "asc" }],
      select: {
        assetId: true,
        capturedAt: true,
        price: true,
        asset: {
          select: {
            category: true,
          },
        },
      },
    }),
  ]);

  const analytics = buildSaasPortfolioAnalytics({
    baseCurrency: portfolio.baseCurrency,
    positions,
    transactions: analyticsTransactions,
    snapshots: analyticsSnapshots,
  });

  const telegramAssetIds = portfolio.positions
    .filter((position) => position.asset.category === "TELEGRAM")
    .map((position) => position.assetId);

  const telegramPriceUpdates =
    telegramAssetIds.length > 0
      ? await prisma.transaction.findMany({
          where: {
            portfolioId: portfolio.id,
            assetId: {
              in: telegramAssetIds,
            },
            action: "PRICE_UPDATE",
          },
          orderBy: [{ occurredAt: "desc" }],
          select: {
            id: true,
            assetId: true,
            occurredAt: true,
            unitPrice: true,
            currency: true,
            notes: true,
            metadata: true,
          },
        })
      : [];

  const telegramHistoryByAssetId = new Map<string, ReturnType<typeof extractTelegramPriceUpdateHistoryRow>[]>();
  for (const transaction of telegramPriceUpdates) {
    const history = telegramHistoryByAssetId.get(transaction.assetId) ?? [];
    if (history.length < 8) {
      history.push(extractTelegramPriceUpdateHistoryRow(transaction));
    }
    telegramHistoryByAssetId.set(transaction.assetId, history);
  }

  const telegramPricingRows = positions
    .filter((position) => position.category === "telegram")
    .map((position) =>
      buildTelegramGiftPricingRow({
        position,
        baseCurrency: portfolio.baseCurrency,
        history: telegramHistoryByAssetId.get(position.assetId) ?? [],
      }),
    )
    .sort((left, right) => right.totalValue - left.totalValue);

  const telegramPricing = {
    positionCount: telegramPricingRows.length,
    totalValue: telegramPricingRows.reduce((sum, gift) => sum + gift.totalValue, 0),
    staleCount: telegramPricingRows.filter((gift) =>
      isTimestampStale(gift.lastVerifiedAt, getManualStaleAfterMs("telegram")),
    ).length,
    lowConfidenceCount: telegramPricingRows.filter((gift) => gift.confidence === "low").length,
    outlierCount: telegramPricingRows.filter((gift) => gift.latestOutlierMessage !== null).length,
    gifts: telegramPricingRows,
  };

  const warnings = new Set<string>();
  if (positions.length === 0) {
    warnings.add("Р В РІР‚в„ў Р В РЎвЂ”Р В РЎвЂўР РЋР вЂљР РЋРІР‚С™Р РЋРІР‚С›Р В Р’ВµР В Р’В»Р В Р’Вµ Р В РЎвЂ”Р В РЎвЂўР В РЎвЂќР В Р’В° Р В Р вЂ¦Р В Р’ВµР РЋРІР‚С™ Р В РЎвЂ”Р В РЎвЂўР В Р’В·Р В РЎвЂР РЋРІР‚В Р В РЎвЂР В РІвЂћвЂ“. Р В РІР‚СњР В РЎвЂўР В Р’В±Р В Р’В°Р В Р вЂ Р РЋР Р‰Р РЋРІР‚С™Р В Р’Вµ Р В РЎвЂР В РЎВР В РЎвЂ”Р В РЎвЂўР РЋР вЂљР РЋРІР‚С™ Р В РЎвЂР В Р’В»Р В РЎвЂ Р РЋР С“Р В РЎвЂўР В Р’В·Р В РўвЂР В Р’В°Р В РІвЂћвЂ“Р РЋРІР‚С™Р В Р’Вµ Р В Р’В°Р В РЎвЂќР РЋРІР‚С™Р В РЎвЂР В Р вЂ Р РЋРІР‚в„– Р В Р вЂ Р РЋР вЂљР РЋРЎвЂњР РЋРІР‚РЋР В Р вЂ¦Р РЋРЎвЂњР РЋР вЂ№ Р В Р вЂ¦Р В Р’В° Р РЋР С“Р В Р’В»Р В Р’ВµР В РўвЂР РЋРЎвЂњР РЋР вЂ№Р РЋРІР‚В°Р В РЎвЂР РЋРІР‚В¦ Р РЋР РЉР РЋРІР‚С™Р В Р’В°Р В РЎвЂ”Р В Р’В°Р РЋРІР‚В¦.");
  }
  if (portfolio._count.transactions === 0) {
    warnings.add("Р В Р’ВР РЋР С“Р РЋРІР‚С™Р В РЎвЂўР РЋР вЂљР В РЎвЂР РЋР РЏ Р РЋРІР‚С™Р РЋР вЂљР В Р’В°Р В Р вЂ¦Р В Р’В·Р В Р’В°Р В РЎвЂќР РЋРІР‚В Р В РЎвЂР В РІвЂћвЂ“ Р В РЎвЂ”Р РЋРЎвЂњР РЋР С“Р РЋРІР‚С™Р В Р’В°. PnL Р В РЎвЂ”Р В РЎвЂўР В РЎвЂќР В Р’В° Р РЋР С“Р РЋРІР‚РЋР В РЎвЂР РЋРІР‚С™Р В Р’В°Р В Р’ВµР РЋРІР‚С™Р РЋР С“Р РЋР РЏ Р В РЎвЂ”Р В РЎвЂў Р РЋР С“Р В РЎвЂўР РЋР С“Р РЋРІР‚С™Р В РЎвЂўР РЋР РЏР В Р вЂ¦Р В РЎвЂР РЋР вЂ№ Р В РЎвЂ”Р В РЎвЂўР В Р’В·Р В РЎвЂР РЋРІР‚В Р В РЎвЂР В РІвЂћвЂ“.");
  }
  if (portfolio._count.integrations === 0) {
    warnings.add("Р В Р’ВР В Р вЂ¦Р РЋРІР‚С™Р В Р’ВµР В РЎвЂ“Р РЋР вЂљР В Р’В°Р РЋРІР‚В Р В РЎвЂР В РЎвЂ Р В Р’ВµР РЋРІР‚В°Р В Р’Вµ Р В Р вЂ¦Р В Р’Вµ Р В РЎвЂ”Р В РЎвЂўР В РўвЂР В РЎвЂќР В Р’В»Р РЋР вЂ№Р РЋРІР‚РЋР В Р’ВµР В Р вЂ¦Р РЋРІР‚в„–. Import Center Р В РЎвЂ live sync Р В Р’В±Р РЋРЎвЂњР В РўвЂР РЋРЎвЂњР РЋРІР‚С™ Р РЋР вЂљР В Р’В°Р РЋР С“Р РЋРІвЂљВ¬Р В РЎвЂР РЋР вЂљР РЋР РЏР РЋРІР‚С™Р РЋР Р‰Р РЋР С“Р РЋР РЏ Р В Р вЂ¦Р В Р’В° Р РЋР С“Р В Р’В»Р В Р’ВµР В РўвЂР РЋРЎвЂњР РЋР вЂ№Р РЋРІР‚В°Р В РЎвЂР РЋРІР‚В¦ Р РЋР РЉР РЋРІР‚С™Р В Р’В°Р В РЎвЂ”Р В Р’В°Р РЋРІР‚В¦.");
  }

  const unknownPriceCount = positions.filter(
    (position) => position.priceConfidenceStatus === "unknown",
  ).length;
  if (unknownPriceCount > 0) {
    warnings.add(
      `Unified price engine Р В Р вЂ¦Р В Р’Вµ Р РЋР С“Р В РЎВР В РЎвЂўР В РЎвЂ“ Р В РЎвЂўР РЋРІР‚В Р В Р’ВµР В Р вЂ¦Р В РЎвЂР РЋРІР‚С™Р РЋР Р‰ ${unknownPriceCount} Р В РЎвЂ”Р В РЎвЂўР В Р’В·. Р В РЎвЂєР В Р’В±Р РЋРІР‚В°Р В Р’В°Р РЋР РЏ Р РЋР С“Р РЋРІР‚С™Р В РЎвЂўР В РЎвЂР В РЎВР В РЎвЂўР РЋР С“Р РЋРІР‚С™Р РЋР Р‰ Р В РЎвЂ”Р В РЎвЂўР В РЎвЂќР В Р’В° Р В Р вЂ¦Р В Р’ВµР В РЎвЂ”Р В РЎвЂўР В Р’В»Р В Р вЂ¦Р В Р’В°Р РЋР РЏ.`,
    );
  }

  const stalePriceCount = positions.filter(
    (position) => position.priceConfidenceStatus === "stale",
  ).length;
  if (stalePriceCount > 0) {
    warnings.add(
      `Р В Р в‚¬ ${stalePriceCount} Р В РЎвЂ”Р В РЎвЂўР В Р’В·Р В РЎвЂР РЋРІР‚В Р В РЎвЂР В РІвЂћвЂ“ Р РЋРЎвЂњР РЋР С“Р РЋРІР‚С™Р В Р’В°Р РЋР вЂљР В Р’ВµР В Р вЂ Р РЋРІвЂљВ¬Р В Р’В°Р РЋР РЏ Р РЋР вЂљР РЋРЎвЂњР РЋРІР‚РЋР В Р вЂ¦Р В Р’В°Р РЋР РЏ Р РЋРІР‚В Р В Р’ВµР В Р вЂ¦Р В Р’В°. Р В РЎвЂєР В Р’В±Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В РЎвЂР РЋРІР‚С™Р В Р’Вµ quotes Р В РЎвЂР В Р’В»Р В РЎвЂ Р В РЎвЂР В РЎВР В РЎвЂ”Р В РЎвЂўР РЋР вЂљР РЋРІР‚С™.`,
    );
  }

  if (telegramPricing.staleCount > 0) {
    warnings.add(
      `Telegram Gifts: ${telegramPricing.staleCount} quotes Р РЋРІР‚С™Р РЋР вЂљР В Р’ВµР В Р’В±Р РЋРЎвЂњР РЋР вЂ№Р РЋРІР‚С™ Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В РЎвЂўР В РЎвЂ“Р В РЎвЂў OTC review.`,
    );
  }

  if (telegramPricing.lowConfidenceCount > 0) {
    warnings.add(
      `Telegram Gifts: ${telegramPricing.lowConfidenceCount} quotes Р В РЎвЂўР РЋРІР‚С™Р В РЎВР В Р’ВµР РЋРІР‚РЋР В Р’ВµР В Р вЂ¦Р РЋРІР‚в„– Р В РЎвЂќР В Р’В°Р В РЎвЂќ low confidence.`,
    );
  }

  if (telegramPricing.outlierCount > 0) {
    warnings.add(
      `Telegram Gifts: Р В Р вЂ¦Р В Р’В°Р В РІвЂћвЂ“Р В РўвЂР В Р’ВµР В Р вЂ¦Р В РЎвЂў ${telegramPricing.outlierCount} Р В РЎвЂ”Р В РЎвЂўР В Р’В·Р В РЎвЂР РЋРІР‚В Р В РЎвЂР В РІвЂћвЂ“ Р РЋР С“ Р РЋР С“Р В РЎвЂР В Р’В»Р РЋР Р‰Р В Р вЂ¦Р РЋРІР‚в„–Р В РЎВ Р В РЎвЂўР РЋРІР‚С™Р В РЎвЂќР В Р’В»Р В РЎвЂўР В Р вЂ¦Р В Р’ВµР В Р вЂ¦Р В РЎвЂР В Р’ВµР В РЎВ Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В РЎвЂўР В РІвЂћвЂ“ Р РЋРІР‚В Р В Р’ВµР В Р вЂ¦Р РЋРІР‚в„– Р В РЎвЂўР РЋРІР‚С™ Р В РЎвЂ”Р РЋР вЂљР В Р’ВµР В РўвЂР РЋРІР‚в„–Р В РўвЂР РЋРЎвЂњР РЋРІР‚В°Р В Р’ВµР В РІвЂћвЂ“.`,
    );
  }

  for (const warning of pricedPortfolio.warnings) {
    warnings.add(warning);
  }

  for (const warning of analytics.warnings) {
    warnings.add(warning);
  }

  const byCategory = new Map<
    string,
    {
      label: string;
      color: string;
      cost: number;
      value: number;
    }
  >();

  for (const position of positions) {
    const meta = getCategoryMeta(position.category);
    const current = byCategory.get(position.category) ?? {
      label: meta.label,
      color: meta.color,
      cost: 0,
      value: 0,
    };

    current.cost += position.totalCost;
    current.value += position.totalValue;
    byCategory.set(position.category, current);
  }

  const allocation = [...byCategory.values()].map((entry) => ({
    name: entry.label,
    value: entry.value,
    color: entry.color,
  }));

  const categoryPerformance = [...byCategory.values()].map((entry) => ({
    category: entry.label,
    cost: entry.cost,
    value: entry.value,
  }));

  const cards: SaasPortfolioDetail["cards"] = [
    {
      id: "total-value",
      label: "Р В Р Р‹Р РЋРІР‚С™Р В РЎвЂўР В РЎвЂР В РЎВР В РЎвЂўР РЋР С“Р РЋРІР‚С™Р РЋР Р‰",
      value: totalValue,
      hint: "Р В РЎС›Р В Р’ВµР В РЎвЂќР РЋРЎвЂњР РЋРІР‚В°Р В Р’В°Р РЋР РЏ Р В РЎвЂўР РЋРІР‚В Р В Р’ВµР В Р вЂ¦Р В РЎвЂќР В Р’В° Р В Р вЂ Р РЋР С“Р В Р’ВµР РЋРІР‚В¦ Р В РЎвЂ”Р В РЎвЂўР В Р’В·Р В РЎвЂР РЋРІР‚В Р В РЎвЂР В РІвЂћвЂ“ Р РЋРІР‚РЋР В Р’ВµР РЋР вЂљР В Р’ВµР В Р’В· unified price engine.",
      format: "currency" as const,
      tone: "neutral" as const,
    },
    {
      id: "total-cost",
      label: "Р В Р Р‹Р В Р’ВµР В Р’В±Р В Р’ВµР РЋР С“Р РЋРІР‚С™Р В РЎвЂўР В РЎвЂР В РЎВР В РЎвЂўР РЋР С“Р РЋРІР‚С™Р РЋР Р‰",
      value: totalCost,
      hint: "Р В Р Р‹Р РЋРЎвЂњР В РЎВР В РЎВР В Р’В°Р РЋР вЂљР В Р вЂ¦Р В Р’В°Р РЋР РЏ Р РЋР С“Р РЋРІР‚С™Р В РЎвЂўР В РЎвЂР В РЎВР В РЎвЂўР РЋР С“Р РЋРІР‚С™Р РЋР Р‰ Р В Р вЂ Р РЋРІР‚В¦Р В РЎвЂўР В РўвЂР В Р’В° Р В РЎвЂ”Р В РЎвЂў Р В РЎвЂ”Р В РЎвЂўР В Р’В·Р В РЎвЂР РЋРІР‚В Р В РЎвЂР РЋР РЏР В РЎВ.",
      format: "currency" as const,
      tone: "neutral" as const,
    },
    {
      id: "total-pnl",
      label: "PnL",
      value: totalPnl,
      hint: "Р В Р’В Р В Р’В°Р В Р’В·Р В Р вЂ¦Р В РЎвЂР РЋРІР‚В Р В Р’В° Р В РЎВР В Р’ВµР В Р’В¶Р В РўвЂР РЋРЎвЂњ Р РЋРІР‚С™Р В Р’ВµР В РЎвЂќР РЋРЎвЂњР РЋРІР‚В°Р В Р’ВµР В РІвЂћвЂ“ Р В РЎвЂўР РЋРІР‚В Р В Р’ВµР В Р вЂ¦Р В РЎвЂќР В РЎвЂўР В РІвЂћвЂ“ Р В РЎвЂ cost basis.",
      format: "currency" as const,
      tone: totalPnl > 0 ? "positive" : totalPnl < 0 ? "negative" : "neutral",
    },
    {
      id: "roi",
      label: "ROI",
      value: roi ?? "Р Р†Р вЂљРІР‚Сњ",
      hint: "Р В РІР‚СњР В РЎвЂўР РЋРІР‚В¦Р В РЎвЂўР В РўвЂР В Р вЂ¦Р В РЎвЂўР РЋР С“Р РЋРІР‚С™Р РЋР Р‰ Р В РЎвЂўР РЋРІР‚С™Р В Р вЂ¦Р В РЎвЂўР РЋР С“Р В РЎвЂР РЋРІР‚С™Р В Р’ВµР В Р’В»Р РЋР Р‰Р В Р вЂ¦Р В РЎвЂў Р РЋР С“Р В Р’ВµР В Р’В±Р В Р’ВµР РЋР С“Р РЋРІР‚С™Р В РЎвЂўР В РЎвЂР В РЎВР В РЎвЂўР РЋР С“Р РЋРІР‚С™Р В РЎвЂ.",
      format: typeof roi === "number" ? "percent" : "text",
      tone: roi !== null ? (roi > 0 ? "positive" : roi < 0 ? "negative" : "neutral") : "neutral",
    },
    {
      id: "positions",
      label: "Р В РЎСџР В РЎвЂўР В Р’В·Р В РЎвЂР РЋРІР‚В Р В РЎвЂР В РЎвЂ",
      value: positions.length,
      hint: "Р В РЎвЂ™Р В РЎвЂќР РЋРІР‚С™Р В РЎвЂР В Р вЂ Р В Р вЂ¦Р РЋРІР‚в„–Р В Р’Вµ holdings Р В Р вЂ  Р РЋР РЉР РЋРІР‚С™Р В РЎвЂўР В РЎВ Р В РЎвЂ”Р В РЎвЂўР РЋР вЂљР РЋРІР‚С™Р РЋРІР‚С›Р В Р’ВµР В Р’В»Р В Р’Вµ.",
      format: "compact" as const,
      tone: "neutral" as const,
    },
    {
      id: "transactions",
      label: "Р В РЎС›Р РЋР вЂљР В Р’В°Р В Р вЂ¦Р В Р’В·Р В Р’В°Р В РЎвЂќР РЋРІР‚В Р В РЎвЂР В РЎвЂ",
      value: portfolio._count.transactions,
      hint: "Р В Р Р‹Р В РЎвЂўР В Р’В±Р РЋРІР‚в„–Р РЋРІР‚С™Р В РЎвЂР РЋР РЏ Р В РЎвЂ”Р В РЎвЂўР В РЎвЂќР РЋРЎвЂњР В РЎвЂ”Р В РЎвЂќР В РЎвЂ, Р В РЎвЂ”Р РЋР вЂљР В РЎвЂўР В РўвЂР В Р’В°Р В Р’В¶Р В РЎвЂ Р В РЎвЂ Р РЋР вЂљР РЋРЎвЂњР РЋРІР‚РЋР В Р вЂ¦Р РЋРІР‚в„–Р РЋРІР‚В¦ Р В РЎвЂўР В Р’В±Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В Р’В»Р В Р’ВµР В Р вЂ¦Р В РЎвЂР В РІвЂћвЂ“.",
      format: "compact" as const,
      tone: "neutral" as const,
    },
  ];

  const recentTransactions: SaasPortfolioTransactionRow[] = portfolio.transactions.map(
    (transaction) => ({
      id: transaction.id,
      action: transaction.action.toLowerCase(),
      occurredAt: transaction.occurredAt.toISOString(),
      assetName: transaction.asset.name,
      category: transaction.asset.category.toLowerCase() as SaasPortfolioTransactionRow["category"],
      quantity: decimalToNumber(transaction.quantity),
      unitPrice: decimalToNumber(transaction.unitPrice),
      fees: decimalToNumber(transaction.fees),
      currency: transaction.currency,
      notes: transaction.notes,
    }),
  );

  const structuredWarnings = [...warnings];
  const insights = await buildPortfolioInsights({
    workspaceId: portfolio.workspaceId,
    portfolioId: portfolio.id,
    portfolioName: portfolio.name,
    baseCurrency: portfolio.baseCurrency,
    totalValue,
    totalCost,
    totalPnl,
    roi,
    positionCount: portfolio._count.positions,
    transactionCount: portfolio._count.transactions,
    warnings: structuredWarnings,
    analytics,
    positions,
    snapshots: analyticsSnapshots.map((snapshot) => ({
      assetId: snapshot.assetId,
      category: snapshot.asset.category.toLowerCase() as SaasAssetCategory,
      capturedAt: snapshot.capturedAt.toISOString(),
      price: decimalToNumber(snapshot.price) ?? 0,
    })),
  });

  return {
    id: portfolio.id,
    workspaceId: portfolio.workspaceId,
    workspaceName: portfolio.workspace.name,
    workspaceSlug: portfolio.workspace.slug,
    name: portfolio.name,
    slug: portfolio.slug,
    visibility: normalizePortfolioVisibility(portfolio.visibility),
    baseCurrency: portfolio.baseCurrency,
    riskProfile: portfolio.riskProfile,
    role,
    canManage,
    isArchived: portfolio.isArchived,
    updatedAt: portfolio.updatedAt.toISOString(),
    createdAt: portfolio.createdAt.toISOString(),
    integrationCount: portfolio._count.integrations,
    positionCount: portfolio._count.positions,
    transactionCount: portfolio._count.transactions,
    totalValue,
    totalCost,
    totalPnl,
    roi,
    cards,
    allocation,
    categoryPerformance,
    positions,
    recentTransactions,
    warnings: structuredWarnings,
    analytics,
    insights,
    telegramPricing,
    integrationSummary: portfolio.integrations.map((integration) => ({
      id: integration.id,
      name: integration.name,
      type: integration.type.toLowerCase(),
      mode: integration.mode.toLowerCase(),
      status: integration.status.toLowerCase(),
      lastSyncedAt: integration.lastSyncedAt?.toISOString() ?? null,
    })),
  };
}

export async function listPortfoliosForWorkspace(
  userId: string,
  workspaceId: string,
): Promise<SaasPortfolioListItem[]> {
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

  return Promise.all(portfolios.map((portfolio) => computePortfolioListItem(portfolio)));
}

