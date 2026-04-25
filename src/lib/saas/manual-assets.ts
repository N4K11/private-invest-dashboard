import "server-only";

import type { AssetCategory, Prisma } from "@prisma/client";

import { canManagePortfolio } from "@/lib/auth/authorization";
import {
  getPortfolioMembershipForUser,
  normalizeWorkspaceRole,
} from "@/lib/auth/workspace";
import { getPrismaClient } from "@/lib/db/client";
import { assertWorkspaceCountLimit } from "@/lib/saas/limits";
import type {
  ManualAssetCreateInput,
  ManualAssetUpdateInput,
} from "@/lib/saas/schema";
import { decimalToNumber } from "@/lib/saas/utils";
import type {
  SaasManualAssetConfidence,
  SaasManualAssetLiquidity,
  SaasTelegramPriceSource,
} from "@/types/saas";

type ManualAssetBaseInput = {
  category: ManualAssetCreateInput["category"];
  name: string;
  quantity: number;
  entryPrice?: number | null;
  currentManualPrice?: number | null;
  currency: string;
  notes?: string;
  tags: string[];
  liquidity: ManualAssetCreateInput["liquidity"];
  confidence: ManualAssetCreateInput["confidence"];
};

type ManualAssetMutationResult = {
  action: "created" | "updated" | "deleted";
  positionId: string;
  assetId: string;
  transactionId: string | null;
};

export type ManualAssetProfile = {
  currency: string | null;
  tags: string[];
  liquidity: SaasManualAssetLiquidity | null;
  confidence: SaasManualAssetConfidence | null;
  priceSource: SaasTelegramPriceSource | null;
  lastVerifiedAt: string | null;
  priceNotes: string | null;
  lastEditedAt: string | null;
};

const MANUAL_SOURCE = "manual_asset_manager";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toJsonRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function normalizeTags(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 12);
}

function normalizeAssetName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^\w\s|()+.#-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function buildAssetNormalizedKey(category: ManualAssetBaseInput["category"], name: string) {
  return `${category}:${normalizeAssetName(name)}`;
}

function mapCategoryToPrisma(category: ManualAssetBaseInput["category"]): AssetCategory {
  switch (category) {
    case "cs2":
      return "CS2";
    case "telegram":
      return "TELEGRAM";
    case "crypto":
      return "CRYPTO";
    default:
      return "CUSTOM";
  }
}

function buildAssetMetadata(
  existingMetadata: Prisma.JsonValue | null | undefined,
  input: ManualAssetBaseInput,
  editedAt: string,
) {
  const metadata = toJsonRecord(existingMetadata);
  const manualAsset = toJsonRecord(metadata.manualAsset);

  return {
    ...metadata,
    manualAsset: {
      ...manualAsset,
      manager: MANUAL_SOURCE,
      category: input.category,
      tags: normalizeTags(input.tags),
      lastEditedAt: editedAt,
    },
  } satisfies Prisma.InputJsonObject;
}

function buildPositionMetadata(
  existingMetadata: Prisma.JsonValue | null | undefined,
  input: ManualAssetBaseInput,
  editedAt: string,
) {
  const metadata = toJsonRecord(existingMetadata);
  const manualAsset = toJsonRecord(metadata.manualAsset);

  return {
    ...metadata,
    manualAsset: {
      ...manualAsset,
      manager: MANUAL_SOURCE,
      currency: input.currency,
      tags: normalizeTags(input.tags),
      liquidity: input.liquidity,
      confidence: input.confidence,
      lastEditedAt: editedAt,
    },
  } satisfies Prisma.InputJsonObject;
}

function pickTransactionUnitPrice(
  action: "BUY" | "SELL",
  input: ManualAssetBaseInput,
  currentPosition?: {
    averageEntryPrice: Prisma.Decimal | null;
    manualCurrentPrice: Prisma.Decimal | null;
    currentPrice: Prisma.Decimal | null;
  },
) {
  if (action === "BUY") {
    return (
      input.entryPrice ??
      input.currentManualPrice ??
      decimalToNumber(currentPosition?.averageEntryPrice) ??
      decimalToNumber(currentPosition?.manualCurrentPrice) ??
      decimalToNumber(currentPosition?.currentPrice) ??
      null
    );
  }

  return (
    input.currentManualPrice ??
    input.entryPrice ??
    decimalToNumber(currentPosition?.manualCurrentPrice) ??
    decimalToNumber(currentPosition?.currentPrice) ??
    decimalToNumber(currentPosition?.averageEntryPrice) ??
    null
  );
}

function buildTransactionNote(action: "BUY" | "SELL", notes?: string) {
  const prefix =
    action === "BUY"
      ? "Manual Asset Manager: buy transaction recorded."
      : "Manual Asset Manager: sell transaction recorded.";

  const trimmedNotes = notes?.trim();
  return trimmedNotes ? `${prefix} ${trimmedNotes}` : prefix;
}

export async function requireManualAssetAccess(userId: string, portfolioId: string) {
  const membership = await getPortfolioMembershipForUser(userId, portfolioId);

  if (!membership) {
    throw new Error("Portfolio was not found or access is missing.");
  }

  const role = normalizeWorkspaceRole(membership.role);
  if (!canManagePortfolio(role)) {
    throw new Error("You do not have permission to manage positions in this portfolio.");
  }

  return membership;
}

export function extractManualAssetProfile(
  metadata: Prisma.JsonValue | null | undefined,
): ManualAssetProfile {
  const manualAsset = toJsonRecord(toJsonRecord(metadata).manualAsset);
  const tags = Array.isArray(manualAsset.tags)
    ? normalizeTags(manualAsset.tags.filter((value): value is string => typeof value === "string"))
    : [];

  const currency = typeof manualAsset.currency === "string" ? manualAsset.currency : null;
  const liquidity =
    manualAsset.liquidity === "high" ||
    manualAsset.liquidity === "medium" ||
    manualAsset.liquidity === "low" ||
    manualAsset.liquidity === "unknown"
      ? manualAsset.liquidity
      : null;
  const confidence =
    manualAsset.confidence === "high" ||
    manualAsset.confidence === "medium" ||
    manualAsset.confidence === "low"
      ? manualAsset.confidence
      : null;
  const priceSource =
    manualAsset.priceSource === "fragment" ||
    manualAsset.priceSource === "otc_deal" ||
    manualAsset.priceSource === "marketplace_listing" ||
    manualAsset.priceSource === "manual_estimate"
      ? manualAsset.priceSource
      : null;
  const lastVerifiedAt =
    typeof manualAsset.lastVerifiedAt === "string" ? manualAsset.lastVerifiedAt : null;
  const priceNotes = typeof manualAsset.priceNotes === "string" ? manualAsset.priceNotes : null;
  const lastEditedAt = typeof manualAsset.lastEditedAt === "string" ? manualAsset.lastEditedAt : null;

  return {
    currency,
    tags,
    liquidity,
    confidence,
    priceSource,
    lastVerifiedAt,
    priceNotes,
    lastEditedAt,
  };
}

export async function createManualAssetPosition(
  userId: string,
  portfolioId: string,
  input: ManualAssetCreateInput,
): Promise<ManualAssetMutationResult> {
  const membership = await requireManualAssetAccess(userId, portfolioId);
  const prisma = getPrismaClient();

  return prisma.$transaction(async (transaction) => {
    const portfolio = await transaction.portfolio.findFirst({
      where: {
        id: portfolioId,
        workspaceId: membership.workspaceId,
        isArchived: false,
      },
      select: {
        id: true,
        workspaceId: true,
      },
    });

    if (!portfolio) {
      throw new Error("Portfolio was not found or is archived.");
    }

    await assertWorkspaceCountLimit(membership.workspaceId, "positions", 1, transaction);

    const editedAt = new Date().toISOString();
    const normalizedKey = buildAssetNormalizedKey(input.category, input.name);

    let asset = await transaction.asset.findUnique({
      where: {
        workspaceId_normalizedKey: {
          workspaceId: membership.workspaceId,
          normalizedKey,
        },
      },
    });

    if (asset) {
      const existingPosition = await transaction.position.findUnique({
        where: {
          portfolioId_assetId: {
            portfolioId,
            assetId: asset.id,
          },
        },
      });

      if (existingPosition) {
        throw new Error("A position for this asset already exists in the portfolio. Edit it instead.");
      }

      asset = await transaction.asset.update({
        where: { id: asset.id },
        data: {
          name: input.name,
          category: mapCategoryToPrisma(input.category),
          externalSource: asset.externalSource ?? MANUAL_SOURCE,
          metadata: buildAssetMetadata(asset.metadata, input, editedAt),
        },
      });
    } else {
      asset = await transaction.asset.create({
        data: {
          workspaceId: membership.workspaceId,
          category: mapCategoryToPrisma(input.category),
          name: input.name,
          symbol: null,
          normalizedKey,
          externalSource: MANUAL_SOURCE,
          metadata: buildAssetMetadata(null, input, editedAt),
        },
      });
    }

    const position = await transaction.position.create({
      data: {
        portfolioId,
        assetId: asset.id,
        quantity: String(input.quantity),
        averageEntryPrice:
          input.entryPrice !== null && input.entryPrice !== undefined ? String(input.entryPrice) : null,
        currentPrice: null,
        manualCurrentPrice:
          input.currentManualPrice !== null && input.currentManualPrice !== undefined
            ? String(input.currentManualPrice)
            : null,
        priceSource: "MANUAL",
        status: "ACTIVE",
        notes: input.notes ?? null,
        metadata: buildPositionMetadata(null, input, editedAt),
      },
    });

    const buyUnitPrice = pickTransactionUnitPrice("BUY", input);
    const generatedTransaction =
      input.transactionMode === "buy"
        ? await transaction.transaction.create({
            data: {
              portfolioId,
              assetId: asset.id,
              action: "BUY",
              occurredAt: new Date(editedAt),
              quantity: String(input.quantity),
              unitPrice: buyUnitPrice !== null ? String(buyUnitPrice) : null,
              currency: input.currency,
              notes: buildTransactionNote("BUY", input.notes),
              metadata: {
                source: MANUAL_SOURCE,
                createdWithPosition: true,
              },
            },
          })
        : null;

    await transaction.auditLog.create({
      data: {
        workspaceId: membership.workspaceId,
        portfolioId,
        userId,
        actorType: "USER",
        action: "position.create",
        entityType: "position",
        entityId: position.id,
        severity: "INFO",
        message: "Created manual asset position from SaaS portfolio detail.",
        payload: {
          assetId: asset.id,
          category: input.category,
          quantity: input.quantity,
          currency: input.currency,
          transactionMode: input.transactionMode,
          transactionId: generatedTransaction?.id ?? null,
        },
      },
    });

    return {
      action: "created",
      positionId: position.id,
      assetId: asset.id,
      transactionId: generatedTransaction?.id ?? null,
    };
  });
}

export async function updateManualAssetPosition(
  userId: string,
  portfolioId: string,
  positionId: string,
  input: ManualAssetUpdateInput,
): Promise<ManualAssetMutationResult> {
  const membership = await requireManualAssetAccess(userId, portfolioId);
  const prisma = getPrismaClient();

  return prisma.$transaction(async (transaction) => {
    const currentPosition = await transaction.position.findFirst({
      where: {
        id: positionId,
        portfolioId,
        portfolio: {
          workspaceId: membership.workspaceId,
          isArchived: false,
        },
      },
      include: {
        asset: true,
      },
    });

    if (!currentPosition) {
      throw new Error("Position was not found or was already removed.");
    }

    const previousQuantity = decimalToNumber(currentPosition.quantity) ?? 0;
    let transactionAction: "BUY" | "SELL" | null = null;
    let transactionQuantity: number | null = null;

    if (input.transactionMode === "buy") {
      transactionQuantity = input.quantity - previousQuantity;
      if (transactionQuantity <= 0) {
        throw new Error("For buy mode the new quantity must be higher than the current quantity.");
      }
      transactionAction = "BUY";
    }

    if (input.transactionMode === "sell") {
      transactionQuantity = previousQuantity - input.quantity;
      if (transactionQuantity <= 0) {
        throw new Error("For sell mode the new quantity must be lower than the current quantity.");
      }
      transactionAction = "SELL";
    }

    const editedAt = new Date().toISOString();
    const normalizedKey = buildAssetNormalizedKey(input.category, input.name);
    let asset = await transaction.asset.findUnique({
      where: {
        workspaceId_normalizedKey: {
          workspaceId: membership.workspaceId,
          normalizedKey,
        },
      },
    });

    if (asset && asset.id !== currentPosition.assetId) {
      const conflictingPosition = await transaction.position.findUnique({
        where: {
          portfolioId_assetId: {
            portfolioId,
            assetId: asset.id,
          },
        },
      });

      if (conflictingPosition) {
        throw new Error("This portfolio already has a position for the target asset.");
      }

      asset = await transaction.asset.update({
        where: { id: asset.id },
        data: {
          name: input.name,
          category: mapCategoryToPrisma(input.category),
          externalSource: asset.externalSource ?? MANUAL_SOURCE,
          metadata: buildAssetMetadata(asset.metadata, input, editedAt),
        },
      });
    } else if (asset) {
      asset = await transaction.asset.update({
        where: { id: asset.id },
        data: {
          name: input.name,
          category: mapCategoryToPrisma(input.category),
          externalSource: asset.externalSource ?? MANUAL_SOURCE,
          metadata: buildAssetMetadata(asset.metadata, input, editedAt),
        },
      });
    } else {
      asset = await transaction.asset.create({
        data: {
          workspaceId: membership.workspaceId,
          category: mapCategoryToPrisma(input.category),
          name: input.name,
          symbol: null,
          normalizedKey,
          externalSource: MANUAL_SOURCE,
          metadata: buildAssetMetadata(null, input, editedAt),
        },
      });
    }

    const updatedPosition = await transaction.position.update({
      where: {
        id: positionId,
      },
      data: {
        assetId: asset.id,
        quantity: String(input.quantity),
        averageEntryPrice:
          input.entryPrice !== null && input.entryPrice !== undefined ? String(input.entryPrice) : null,
        manualCurrentPrice:
          input.currentManualPrice !== null && input.currentManualPrice !== undefined
            ? String(input.currentManualPrice)
            : null,
        priceSource: "MANUAL",
        status: input.quantity > 0 ? "ACTIVE" : "CLOSED",
        notes: input.notes ?? null,
        metadata: buildPositionMetadata(currentPosition.metadata, input, editedAt),
      },
    });

    const transactionUnitPrice =
      transactionAction !== null
        ? pickTransactionUnitPrice(transactionAction, input, currentPosition)
        : null;
    const generatedTransaction =
      transactionAction && transactionQuantity
        ? await transaction.transaction.create({
            data: {
              portfolioId,
              assetId: asset.id,
              action: transactionAction,
              occurredAt: new Date(editedAt),
              quantity: String(transactionQuantity),
              unitPrice: transactionUnitPrice !== null ? String(transactionUnitPrice) : null,
              currency: input.currency,
              notes: buildTransactionNote(transactionAction, input.notes),
              metadata: {
                source: MANUAL_SOURCE,
                positionId,
                previousQuantity,
                nextQuantity: input.quantity,
              },
            },
          })
        : null;

    await transaction.auditLog.create({
      data: {
        workspaceId: membership.workspaceId,
        portfolioId,
        userId,
        actorType: "USER",
        action: "position.update",
        entityType: "position",
        entityId: updatedPosition.id,
        severity: "INFO",
        message: "Updated manual asset position from SaaS portfolio detail.",
        payload: {
          assetId: asset.id,
          category: input.category,
          previousQuantity,
          nextQuantity: input.quantity,
          currency: input.currency,
          transactionMode: input.transactionMode,
          transactionId: generatedTransaction?.id ?? null,
        },
      },
    });

    return {
      action: "updated",
      positionId: updatedPosition.id,
      assetId: asset.id,
      transactionId: generatedTransaction?.id ?? null,
    };
  });
}

export async function deleteManualAssetPosition(
  userId: string,
  portfolioId: string,
  positionId: string,
): Promise<ManualAssetMutationResult> {
  const membership = await requireManualAssetAccess(userId, portfolioId);
  const prisma = getPrismaClient();

  return prisma.$transaction(async (transaction) => {
    const currentPosition = await transaction.position.findFirst({
      where: {
        id: positionId,
        portfolioId,
        portfolio: {
          workspaceId: membership.workspaceId,
          isArchived: false,
        },
      },
      include: {
        asset: true,
      },
    });

    if (!currentPosition) {
      throw new Error("Position was not found or was already removed.");
    }

    await transaction.position.delete({
      where: {
        id: positionId,
      },
    });

    const remainingPositions = await transaction.position.count({
      where: {
        assetId: currentPosition.assetId,
      },
    });
    const remainingTransactions = await transaction.transaction.count({
      where: {
        assetId: currentPosition.assetId,
      },
    });
    const remainingSnapshots = await transaction.priceSnapshot.count({
      where: {
        assetId: currentPosition.assetId,
      },
    });

    if (remainingPositions === 0 && remainingTransactions === 0 && remainingSnapshots === 0) {
      await transaction.asset.delete({
        where: {
          id: currentPosition.assetId,
        },
      });
    }

    await transaction.auditLog.create({
      data: {
        workspaceId: membership.workspaceId,
        portfolioId,
        userId,
        actorType: "USER",
        action: "position.delete",
        entityType: "position",
        entityId: positionId,
        severity: "WARNING",
        message: "Deleted position from Manual Asset Manager.",
        payload: {
          assetId: currentPosition.assetId,
          assetName: currentPosition.asset.name,
          quantity: decimalToNumber(currentPosition.quantity),
          orphanAssetRemoved:
            remainingPositions === 0 && remainingTransactions === 0 && remainingSnapshots === 0,
        },
      },
    });

    return {
      action: "deleted",
      positionId,
      assetId: currentPosition.assetId,
      transactionId: null,
    };
  });
}
