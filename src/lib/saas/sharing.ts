import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { canManagePortfolio } from "@/lib/auth/authorization";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  getPortfolioMembershipForUser,
  normalizeWorkspaceRole,
} from "@/lib/auth/workspace";
import { CATEGORY_META, DASHBOARD_COOKIE_NAME } from "@/lib/constants";
import { getPrismaClient } from "@/lib/db/client";
import { getAuthSecret, getEnv } from "@/lib/env";
import { pricePortfolioPositions } from "@/lib/saas/portfolio-pricing";
import type { ShareLinkCreateInput } from "@/lib/saas/schema";
import type { SummaryCardDatum } from "@/types/portfolio";
import type {
  SaasAssetCategory,
  SaasPortfolioShareLink,
  SaasPortfolioShareScope,
  SaasSharedAllocationRow,
  SaasSharedPortfolioPositionRow,
  SaasSharedPortfolioView,
} from "@/types/saas";

const SHARE_BASE_PATH = "share";
const SHARE_ACCESS_COOKIE_PREFIX = "portfolio_share_access";
const DEFAULT_SHARE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

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

type ShareLinkStatus = "active" | "expired" | "revoked";

type ShareLinkScopeRecord = {
  hideValues: boolean;
  hideQuantities: boolean;
  hidePnl: boolean;
  allocationOnly: boolean;
};

type ShareLinkWithPortfolio = {
  id: string;
  workspaceId: string;
  portfolioId: string;
  label: string | null;
  token: string;
  passwordHash: string | null;
  hideValues: boolean;
  hideQuantities: boolean;
  hidePnl: boolean;
  allocationOnly: boolean;
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastAccessedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  portfolio: {
    id: string;
    workspaceId: string;
    name: string;
    baseCurrency: string;
    updatedAt: Date;
    isArchived: boolean;
    workspace: {
      id: string;
      name: string;
      isArchived: boolean;
    };
    positions: Parameters<typeof pricePortfolioPositions>[0]["positions"];
  };
};

type ShareAccessGrant = {
  id: string;
  token: string;
  updatedAt: Date;
  expiresAt: Date | null;
};

export type SharedPortfolioResolveResult =
  | { status: "not_found" }
  | { status: "revoked"; shareLabel: string | null }
  | { status: "expired"; shareLabel: string | null }
  | {
      status: "password_required";
      shareLabel: string | null;
      expiresAt: string | null;
      scope: SaasPortfolioShareScope;
    }
  | { status: "ready"; view: SaasSharedPortfolioView };

function getShareAccessSecret() {
  return getAuthSecret() ?? getEnv().DASHBOARD_SECRET_TOKEN ?? DASHBOARD_COOKIE_NAME;
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function signValue(value: string) {
  return createHmac("sha256", getShareAccessSecret()).update(value).digest("hex");
}

function secureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function getShareAccessCookieName(shareToken: string) {
  return `${SHARE_ACCESS_COOKIE_PREFIX}_${hashValue(shareToken).slice(0, 20)}`;
}

function getShareScope(link: ShareLinkScopeRecord): SaasPortfolioShareScope {
  return {
    hideValues: link.hideValues,
    hideQuantities: link.hideQuantities,
    hidePnl: link.hidePnl,
    allocationOnly: link.allocationOnly,
  };
}

function getShareStatus(link: Pick<ShareLinkWithPortfolio, "expiresAt" | "revokedAt">): ShareLinkStatus {
  if (link.revokedAt) {
    return "revoked";
  }

  if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
    return "expired";
  }

  return "active";
}


function getCategoryMeta(category: SaasAssetCategory) {
  if (category === "custom" || category === "nft") {
    return EXTRA_CATEGORY_META[category];
  }

  return CATEGORY_META[category];
}

function getBaseUrl() {
  const env = getEnv();
  return env.NEXTAUTH_URL?.trim() || env.NEXT_PUBLIC_SITE_URL?.trim() || "";
}

export function getShareRoutePath(shareToken: string) {
  return `/${SHARE_BASE_PATH}/${shareToken}`;
}

function getShareRouteUrl(shareToken: string) {
  const baseUrl = getBaseUrl().replace(/\/$/, "");
  const path = getShareRoutePath(shareToken);
  return baseUrl ? `${baseUrl}${path}` : path;
}

function buildShareAccessCookieValue(grant: ShareAccessGrant) {
  const encoded = Buffer.from(
    JSON.stringify({
      shareId: grant.id,
      shareToken: grant.token,
      updatedAt: grant.updatedAt.getTime(),
      expiresAt: grant.expiresAt?.getTime() ?? null,
    }),
  ).toString("base64url");

  return `${encoded}.${signValue(encoded)}`;
}

function parseShareAccessCookieValue(value?: string | null) {
  if (!value) {
    return null;
  }

  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expectedSignature = signValue(encoded);
  if (!secureEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
      shareId?: string;
      shareToken?: string;
      updatedAt?: number;
      expiresAt?: number | null;
    };

    if (
      typeof parsed.shareId !== "string" ||
      typeof parsed.shareToken !== "string" ||
      typeof parsed.updatedAt !== "number"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function hasValidShareAccessCookie(link: ShareAccessGrant, cookieValue?: string | null) {
  const parsed = parseShareAccessCookieValue(cookieValue);
  if (!parsed) {
    return false;
  }

  if (parsed.shareId !== link.id || parsed.shareToken !== link.token) {
    return false;
  }

  if (parsed.updatedAt !== link.updatedAt.getTime()) {
    return false;
  }

  const expiresAt = link.expiresAt?.getTime() ?? null;
  if (parsed.expiresAt !== expiresAt) {
    return false;
  }

  if (expiresAt !== null && expiresAt <= Date.now()) {
    return false;
  }

  return true;
}

export function setShareAccessCookie(response: NextResponse, grant: ShareAccessGrant) {
  const expiresAtMs = grant.expiresAt?.getTime() ?? null;
  const maxAge =
    expiresAtMs !== null
      ? Math.max(Math.floor((expiresAtMs - Date.now()) / 1000), 60)
      : DEFAULT_SHARE_COOKIE_MAX_AGE_SECONDS;

  response.cookies.set({
    name: getShareAccessCookieName(grant.token),
    value: buildShareAccessCookieValue(grant),
    httpOnly: true,
    sameSite: "lax",
    secure: getEnv().NODE_ENV === "production",
    path: getShareRoutePath(grant.token),
    maxAge,
  });

  return response;
}

export function clearShareAccessCookie(response: NextResponse, shareToken: string) {
  response.cookies.set({
    name: getShareAccessCookieName(shareToken),
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: getEnv().NODE_ENV === "production",
    path: getShareRoutePath(shareToken),
    maxAge: 0,
  });

  return response;
}

function mapShareLinkRow(link: Pick<ShareLinkWithPortfolio, "id" | "label" | "token" | "passwordHash" | "expiresAt" | "revokedAt" | "lastAccessedAt" | "createdAt" | "updatedAt" | "hideValues" | "hideQuantities" | "hidePnl" | "allocationOnly">): SaasPortfolioShareLink {
  return {
    id: link.id,
    label: link.label,
    sharePath: getShareRoutePath(link.token),
    shareUrl: getShareRouteUrl(link.token),
    requiresPassword: Boolean(link.passwordHash),
    expiresAt: link.expiresAt?.toISOString() ?? null,
    revokedAt: link.revokedAt?.toISOString() ?? null,
    lastAccessedAt: link.lastAccessedAt?.toISOString() ?? null,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
    status: getShareStatus(link),
    scope: getShareScope(link),
  };
}

function buildAllocationRows(view: Awaited<ReturnType<typeof pricePortfolioPositions>>, scope: SaasPortfolioShareScope): SaasSharedAllocationRow[] {
  const grouped = new Map<SaasAssetCategory, number>();

  for (const position of view.positions) {
    grouped.set(position.category, (grouped.get(position.category) ?? 0) + position.totalValue);
  }

  return [...grouped.entries()]
    .map(([category, value]) => {
      const meta = getCategoryMeta(category);
      return {
        category,
        label: meta.label,
        color: meta.color,
        weight: view.totalValue > 0 ? (value / view.totalValue) * 100 : 0,
        value: scope.hideValues ? null : value,
      };
    })
    .sort((left, right) => right.weight - left.weight);
}

function buildSharedSummaryCards(params: {
  totalValue: number;
  totalPnl: number;
  totalCost: number;
  positionCount: number;
  allocationCount: number;
  scope: SaasPortfolioShareScope;
}): SummaryCardDatum[] {
  const roi = params.totalCost > 0 ? (params.totalPnl / params.totalCost) * 100 : null;

  return [
    {
      id: "shared-total-value",
      label: "Portfolio value",
      value: params.scope.hideValues ? "Hidden" : params.totalValue,
      hint: params.scope.hideValues
        ? "Owner hid valuation on this share link."
        : "Current valuation from the portfolio price engine.",
      format: params.scope.hideValues ? "text" : "currency",
      tone: "neutral",
    },
    {
      id: "shared-total-pnl",
      label: "PnL",
      value: params.scope.hidePnl ? "Hidden" : params.totalPnl,
      hint: params.scope.hidePnl
        ? "PnL is hidden by the share scope."
        : roi !== null
          ? `ROI ${roi.toFixed(1)}%`
          : "Cost basis is not available for ROI.",
      format: params.scope.hidePnl ? "text" : "currency",
      tone: params.scope.hidePnl ? "neutral" : params.totalPnl >= 0 ? "positive" : "negative",
    },
    {
      id: "shared-position-count",
      label: "Positions",
      value: params.positionCount,
      hint: "Number of current holdings included in this shared view.",
      format: "compact",
      tone: "neutral",
    },
    {
      id: "shared-allocation-count",
      label: "Asset classes",
      value: params.allocationCount,
      hint: "Number of allocation buckets visible on this link.",
      format: "compact",
      tone: "neutral",
    },
  ];
}

function mapSharedPositions(
  view: Awaited<ReturnType<typeof pricePortfolioPositions>>,
  scope: SaasPortfolioShareScope,
): SaasSharedPortfolioPositionRow[] {
  return view.positions.map((position) => ({
    id: position.id,
    assetId: position.assetId,
    assetName: position.assetName,
    symbol: position.symbol,
    category: position.category,
    quantity: scope.hideQuantities ? null : position.quantity,
    currentPrice: scope.hideValues ? null : position.currentPrice,
    totalValue: scope.hideValues ? null : position.totalValue,
    pnl: scope.hidePnl ? null : position.pnl,
    priceSource: position.priceSource,
    priceUpdatedAt: position.priceUpdatedAt,
    priceWarning: position.priceWarning,
  }));
}

async function loadShareLinkByToken(shareToken: string) {
  const prisma = getPrismaClient();

  return prisma.shareLink.findUnique({
    where: {
      token: shareToken,
    },
    include: {
      portfolio: {
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
              isArchived: true,
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
        },
      },
    },
  }) as Promise<ShareLinkWithPortfolio | null>;
}

function isSharePortfolioUsable(
  link: ShareLinkWithPortfolio | null,
): link is ShareLinkWithPortfolio {
  return Boolean(
    link &&
      !link.portfolio.isArchived &&
      !link.portfolio.workspace.isArchived,
  );
}

export async function listShareLinksForPortfolioForUser(userId: string, portfolioId: string) {
  const membership = await getPortfolioMembershipForUser(userId, portfolioId);

  if (!membership || !canManagePortfolio(normalizeWorkspaceRole(membership.role))) {
    return [] as SaasPortfolioShareLink[];
  }

  const prisma = getPrismaClient();
  const links = await prisma.shareLink.findMany({
    where: {
      portfolioId,
      workspaceId: membership.workspaceId,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return links.map((link) => mapShareLinkRow(link));
}

export async function createShareLinkForPortfolio(
  userId: string,
  portfolioId: string,
  input: ShareLinkCreateInput,
) {
  const membership = await getPortfolioMembershipForUser(userId, portfolioId);

  if (!membership) {
    throw new Error("Portfolio not found.");
  }

  const role = normalizeWorkspaceRole(membership.role);
  if (!canManagePortfolio(role)) {
    throw new Error("Insufficient permissions to create share links.");
  }

  const prisma = getPrismaClient();
  const portfolio = await prisma.portfolio.findFirst({
    where: {
      id: portfolioId,
      workspaceId: membership.workspaceId,
      isArchived: false,
    },
    select: {
      id: true,
      workspaceId: true,
      name: true,
    },
  });

  if (!portfolio) {
    throw new Error("Portfolio not found.");
  }

  const passwordHash = input.password ? await hashPassword(input.password) : null;
  const token = randomBytes(24).toString("hex");
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

  const link = await prisma.$transaction(async (transaction) => {
    const created = await transaction.shareLink.create({
      data: {
        workspaceId: portfolio.workspaceId,
        portfolioId: portfolio.id,
        label: input.label ?? null,
        token,
        passwordHash,
        hideValues: input.hideValues,
        hideQuantities: input.hideQuantities,
        hidePnl: input.hidePnl,
        allocationOnly: input.allocationOnly,
        expiresAt,
      },
    });

    await transaction.auditLog.create({
      data: {
        workspaceId: portfolio.workspaceId,
        portfolioId: portfolio.id,
        userId,
        actorType: "USER",
        action: "share_link.create",
        entityType: "share_link",
        entityId: created.id,
        severity: "INFO",
        message: "Created portfolio share link.",
        payload: {
          hasPassword: Boolean(passwordHash),
          expiresAt: created.expiresAt?.toISOString() ?? null,
          scope: getShareScope(created),
        },
      },
    });

    return created;
  });

  return mapShareLinkRow(link);
}

export async function revokeShareLinkForPortfolio(
  userId: string,
  portfolioId: string,
  shareLinkId: string,
) {
  const membership = await getPortfolioMembershipForUser(userId, portfolioId);

  if (!membership) {
    throw new Error("Portfolio not found.");
  }

  const role = normalizeWorkspaceRole(membership.role);
  if (!canManagePortfolio(role)) {
    throw new Error("Insufficient permissions to revoke share links.");
  }

  const prisma = getPrismaClient();
  const existing = await prisma.shareLink.findFirst({
    where: {
      id: shareLinkId,
      portfolioId,
      workspaceId: membership.workspaceId,
    },
  });

  if (!existing) {
    throw new Error("Share link not found.");
  }

  const revoked = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.shareLink.update({
      where: {
        id: existing.id,
      },
      data: {
        revokedAt: existing.revokedAt ?? new Date(),
      },
    });

    await transaction.auditLog.create({
      data: {
        workspaceId: membership.workspaceId,
        portfolioId,
        userId,
        actorType: "USER",
        action: "share_link.revoke",
        entityType: "share_link",
        entityId: existing.id,
        severity: "INFO",
        message: "Revoked portfolio share link.",
        payload: {
          shareLinkId: existing.id,
          previousRevokedAt: existing.revokedAt?.toISOString() ?? null,
        },
      },
    });

    return updated;
  });

  return mapShareLinkRow(revoked);
}

export async function unlockShareLink(shareToken: string, password: string) {
  const link = await loadShareLinkByToken(shareToken);

  if (!isSharePortfolioUsable(link)) {
    throw new Error("Share link not found.");
  }

  const status = getShareStatus(link);
  if (status === "revoked") {
    throw new Error("Share link has been revoked.");
  }

  if (status === "expired") {
    throw new Error("Share link has expired.");
  }

  if (!link.passwordHash) {
    return {
      id: link.id,
      token: link.token,
      updatedAt: link.updatedAt,
      expiresAt: link.expiresAt,
    } satisfies ShareAccessGrant;
  }

  const isValidPassword = await verifyPassword(password, link.passwordHash);
  if (!isValidPassword) {
    throw new Error("Incorrect share password.");
  }

  return {
    id: link.id,
    token: link.token,
    updatedAt: link.updatedAt,
    expiresAt: link.expiresAt,
  } satisfies ShareAccessGrant;
}

export async function resolveSharedPortfolioViewByToken(
  shareToken: string,
  cookieValue?: string | null,
): Promise<SharedPortfolioResolveResult> {
  const link = await loadShareLinkByToken(shareToken);

  if (!isSharePortfolioUsable(link)) {
    return {
      status: "not_found",
    };
  }

  const status = getShareStatus(link);
  if (status === "revoked") {
    return {
      status: "revoked",
      shareLabel: link.label,
    };
  }

  if (status === "expired") {
    return {
      status: "expired",
      shareLabel: link.label,
    };
  }

  const grant = {
    id: link.id,
    token: link.token,
    updatedAt: link.updatedAt,
    expiresAt: link.expiresAt,
  } satisfies ShareAccessGrant;

  if (link.passwordHash && !hasValidShareAccessCookie(grant, cookieValue)) {
    return {
      status: "password_required",
      shareLabel: link.label,
      expiresAt: link.expiresAt?.toISOString() ?? null,
      scope: getShareScope(link),
    };
  }

  const pricedPortfolio = await pricePortfolioPositions({
    portfolioId: link.portfolio.id,
    workspaceId: link.portfolio.workspaceId,
    baseCurrency: link.portfolio.baseCurrency,
    positions: link.portfolio.positions,
  });
  const scope = getShareScope(link);
  const allocation = buildAllocationRows(pricedPortfolio, scope);
  const summaryCards = buildSharedSummaryCards({
    totalValue: pricedPortfolio.totalValue,
    totalPnl: pricedPortfolio.totalPnl,
    totalCost: pricedPortfolio.totalCost,
    positionCount: pricedPortfolio.positions.length,
    allocationCount: allocation.length,
    scope,
  });
  const positions = scope.allocationOnly ? [] : mapSharedPositions(pricedPortfolio, scope);

  await getPrismaClient().shareLink.update({
    where: {
      id: link.id,
    },
    data: {
      lastAccessedAt: new Date(),
    },
  });

  return {
    status: "ready",
    view: {
      shareToken: link.token,
      shareLabel: link.label,
      portfolioName: link.portfolio.name,
      workspaceName: link.portfolio.workspace.name,
      baseCurrency: link.portfolio.baseCurrency,
      updatedAt: link.portfolio.updatedAt.toISOString(),
      expiresAt: link.expiresAt?.toISOString() ?? null,
      scope,
      summaryCards,
      allocation,
      positions,
      positionCount: pricedPortfolio.positions.length,
      valueVisibility: scope.hideValues ? "hidden" : "visible",
      quantityVisibility: scope.hideQuantities ? "hidden" : "visible",
      pnlVisibility: scope.hidePnl ? "hidden" : "visible",
    },
  };
}