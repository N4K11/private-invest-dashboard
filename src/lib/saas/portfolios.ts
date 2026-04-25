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
import type {
  PortfolioCreateInput,
  PortfolioUpdateInput,
} from "@/lib/saas/schema";
import { extractManualAssetProfile } from "@/lib/saas/manual-assets";
import {
  decimalToNumber,
  mapVisibilityToPrisma,
  normalizeAssetCategory,
  normalizePortfolioVisibility,
} from "@/lib/saas/utils";
import type {
  SaasPortfolioDetail,
  SaasPortfolioListItem,
  SaasPortfolioPositionRow,
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

function buildPortfolioSlug(base: string, attempt: number) {
  return attempt === 0 ? base : `${base}-${attempt + 1}`;
}

function getCategoryMeta(category: ReturnType<typeof normalizeAssetCategory>) {
  if (category === "custom" || category === "nft") {
    return EXTRA_CATEGORY_META[category];
  }

  return CATEGORY_META[category];
}

function computePositionMetrics(position: {
  id: string;
  assetId: string;
  quantity: Prisma.Decimal;
  averageEntryPrice: Prisma.Decimal | null;
  currentPrice: Prisma.Decimal | null;
  manualCurrentPrice: Prisma.Decimal | null;
  priceSource: string | null;
  status: string;
  notes: string | null;
  metadata: Prisma.JsonValue | null;
  updatedAt: Date;
  integration: { name: string } | null;
  asset: {
    name: string;
    symbol: string | null;
    category: "CS2" | "TELEGRAM" | "CRYPTO" | "CUSTOM" | "NFT";
  };
}): SaasPortfolioPositionRow {
  const quantity = decimalToNumber(position.quantity) ?? 0;
  const averageEntryPrice = decimalToNumber(position.averageEntryPrice);
  const manualCurrentPrice = decimalToNumber(position.manualCurrentPrice);
  const currentPrice = decimalToNumber(position.currentPrice);
  const manualProfile = extractManualAssetProfile(position.metadata);
  const effectiveCurrentPrice = manualCurrentPrice ?? currentPrice ?? averageEntryPrice ?? 0;
  const totalValue = quantity * effectiveCurrentPrice;
  const totalCost = quantity * (averageEntryPrice ?? 0);

  return {
    id: position.id,
    assetId: position.assetId,
    assetName: position.asset.name,
    symbol: position.asset.symbol,
    category: normalizeAssetCategory(position.asset.category),
    quantity,
    averageEntryPrice,
    currentPrice,
    manualCurrentPrice,
    currency: manualProfile.currency,
    tags: manualProfile.tags,
    liquidity: manualProfile.liquidity,
    confidence: manualProfile.confidence,
    totalValue,
    totalCost,
    pnl: totalValue - totalCost,
    priceSource: position.priceSource ? position.priceSource.toLowerCase() : null,
    status: position.status.toLowerCase(),
    integrationName: position.integration?.name ?? null,
    updatedAt: position.updatedAt.toISOString(),
    notes: position.notes,
  };
}

function computePortfolioListItem(portfolio: {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  visibility: "PRIVATE" | "SHARED_LINK" | "WORKSPACE";
  baseCurrency: string;
  riskProfile: string | null;
  createdAt: Date;
  updatedAt: Date;
  positions: Parameters<typeof computePositionMetrics>[0][];
  _count: {
    positions: number;
    transactions: number;
    integrations: number;
  };
}): SaasPortfolioListItem {
  const positionRows = portfolio.positions.map(computePositionMetrics);
  const categories = Array.from(new Set(positionRows.map((position) => position.category)));
  const totalValue = positionRows.reduce((sum, position) => sum + position.totalValue, 0);
  const totalCost = positionRows.reduce((sum, position) => sum + position.totalCost, 0);

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
    totalValue,
    totalCost,
    totalPnl: totalValue - totalCost,
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
    throw new Error("Workspace не найден или доступ к нему потерян.");
  }

  const role = normalizeWorkspaceRole(membership.role);
  if (!canManagePortfolio(role)) {
    throw new Error("Недостаточно прав для создания портфеля в этом workspace.");
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

  throw new Error("Не удалось подобрать свободный slug для нового портфеля.");
}

export async function updatePortfolioById(
  userId: string,
  portfolioId: string,
  input: PortfolioUpdateInput,
) {
  const membership = await getPortfolioMembershipForUser(userId, portfolioId);

  if (!membership) {
    throw new Error("Портфель не найден или доступ к нему отсутствует.");
  }

  const role = normalizeWorkspaceRole(membership.role);
  if (!canManagePortfolio(role)) {
    throw new Error("Недостаточно прав для редактирования портфеля.");
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
    throw new Error("Портфель не найден или доступ к нему отсутствует.");
  }

  const role = normalizeWorkspaceRole(membership.role);
  if (!canArchivePortfolio(role)) {
    throw new Error("Недостаточно прав для удаления портфеля.");
  }

  const prisma = getPrismaClient();

  const remainingPortfolios = await prisma.portfolio.count({
    where: {
      workspaceId: membership.workspaceId,
      isArchived: false,
    },
  });

  if (remainingPortfolios <= 1) {
    throw new Error("Нельзя архивировать последний портфель workspace.");
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
  const positions = portfolio.positions.map(computePositionMetrics).sort((left, right) => {
    return right.totalValue - left.totalValue;
  });

  const totalValue = positions.reduce((sum, position) => sum + position.totalValue, 0);
  const totalCost = positions.reduce((sum, position) => sum + position.totalCost, 0);
  const totalPnl = totalValue - totalCost;
  const roi = totalCost > 0 ? (totalPnl / totalCost) * 100 : null;

  const warnings: string[] = [];
  if (positions.length === 0) {
    warnings.push("В портфеле пока нет позиций. Добавьте импорт или создайте активы вручную на следующих этапах.");
  }
  if (portfolio._count.transactions === 0) {
    warnings.push("История транзакций пуста. PnL пока считается по состоянию позиций.");
  }
  if (portfolio._count.integrations === 0) {
    warnings.push("Интеграции еще не подключены. Импорт и live sync будут добавлены на следующих этапах.");
  }
  if (
    positions.some(
      (position) =>
        position.currentPrice === null &&
        position.manualCurrentPrice === null &&
        position.averageEntryPrice === null,
    )
  ) {
    warnings.push("Часть позиций пока без текущей оценки, поэтому общая стоимость может быть неполной.");
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
      label: "Стоимость",
      value: totalValue,
      hint: "Текущая оценка всех позиций портфеля.",
      format: "currency" as const,
      tone: "neutral" as const,
    },
    {
      id: "total-cost",
      label: "Себестоимость",
      value: totalCost,
      hint: "Суммарная стоимость входа по позициям.",
      format: "currency" as const,
      tone: "neutral" as const,
    },
    {
      id: "total-pnl",
      label: "PnL",
      value: totalPnl,
      hint: "Разница между текущей оценкой и cost basis.",
      format: "currency" as const,
      tone: totalPnl > 0 ? "positive" : totalPnl < 0 ? "negative" : "neutral",
    },
    {
      id: "roi",
      label: "ROI",
      value: roi ?? "—",
      hint: "Доходность относительно себестоимости.",
      format: typeof roi === "number" ? "percent" : "text",
      tone: roi !== null ? (roi > 0 ? "positive" : roi < 0 ? "negative" : "neutral") : "neutral",
    },
    {
      id: "positions",
      label: "Позиции",
      value: positions.length,
      hint: "Активные holdings в этом портфеле.",
      format: "compact" as const,
      tone: "neutral" as const,
    },
    {
      id: "transactions",
      label: "Транзакции",
      value: portfolio._count.transactions,
      hint: "События покупки, продажи и ручных обновлений.",
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
      category: normalizeAssetCategory(transaction.asset.category),
      quantity: decimalToNumber(transaction.quantity),
      unitPrice: decimalToNumber(transaction.unitPrice),
      fees: decimalToNumber(transaction.fees),
      currency: transaction.currency,
      notes: transaction.notes,
    }),
  );

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
    warnings,
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

  return portfolios.map(computePortfolioListItem);
}

