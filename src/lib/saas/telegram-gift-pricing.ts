import "server-only";

import type { Prisma } from "@prisma/client";

import { getPrismaClient } from "@/lib/db/client";
import { requireManualAssetAccess } from "@/lib/saas/manual-assets";
import type { TelegramGiftPriceUpdateInput } from "@/lib/saas/schema";
import { decimalToNumber } from "@/lib/saas/utils";
import { getManualStaleAfterMs, isTimestampStale } from "@/lib/saas/price-engine/utils";
import { formatTelegramPriceSourceLabel } from "@/lib/presentation";
import type {
  SaasManualAssetConfidence,
  SaasTelegramGiftPriceHistoryRow,
  SaasTelegramGiftPricingRow,
  SaasTelegramPriceSource,
} from "@/types/saas";

const TELEGRAM_OUTLIER_THRESHOLD_PERCENT = 35;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toJsonRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

type TelegramPriceOutlierResult = {
  previousPrice: number | null;
  changePercent: number | null;
  isOutlier: boolean;
  message: string | null;
};

export type TelegramGiftPriceUpdateResult = {
  action: "price_updated";
  positionId: string;
  assetId: string;
  transactionId: string;
  previousPrice: number | null;
  currentPrice: number;
  changePercent: number | null;
  isOutlier: boolean;
  outlierMessage: string | null;
};

export function normalizeTelegramPriceSource(value: unknown): SaasTelegramPriceSource | null {
  return value === "fragment" ||
    value === "otc_deal" ||
    value === "marketplace_listing" ||
    value === "manual_estimate"
    ? value
    : null;
}

function normalizeConfidence(value: unknown): SaasManualAssetConfidence | null {
  return value === "high" || value === "medium" || value === "low" ? value : null;
}

function buildOutlierResult(previousPrice: number | null, currentPrice: number): TelegramPriceOutlierResult {
  if (previousPrice === null || previousPrice <= 0) {
    return {
      previousPrice,
      changePercent: null,
      isOutlier: false,
      message: null,
    };
  }

  const changePercent = ((currentPrice - previousPrice) / previousPrice) * 100;
  const absoluteChange = Math.abs(changePercent);
  const isOutlier = absoluteChange >= TELEGRAM_OUTLIER_THRESHOLD_PERCENT;

  return {
    previousPrice,
    changePercent,
    isOutlier,
    message: isOutlier
      ? `Цена изменилась на ${absoluteChange.toFixed(1)}% относительно предыдущего quote. Проверьте OTC источник перед использованием в аналитике.`
      : null,
  };
}

function buildTelegramPositionMetadata(
  existingMetadata: Prisma.JsonValue | null | undefined,
  input: TelegramGiftPriceUpdateInput,
  editedAt: string,
  outlier: TelegramPriceOutlierResult,
) {
  const metadata = toJsonRecord(existingMetadata);
  const manualAsset = toJsonRecord(metadata.manualAsset);

  return {
    ...metadata,
    manualAsset: {
      ...manualAsset,
      manager: manualAsset.manager ?? "manual_asset_manager",
      currency: input.currency,
      confidence: input.confidence,
      priceSource: input.priceSource,
      priceNotes: input.notes ?? null,
      lastVerifiedAt: input.lastVerifiedAt,
      lastEditedAt: editedAt,
      lastOutlierAlert: outlier.isOutlier
        ? {
            previousPrice: outlier.previousPrice,
            changePercent: outlier.changePercent,
            message: outlier.message,
            detectedAt: editedAt,
          }
        : null,
    },
  } satisfies Prisma.InputJsonObject;
}

function buildPriceUpdateMetadata(
  input: TelegramGiftPriceUpdateInput,
  outlier: TelegramPriceOutlierResult,
) {
  return {
    source: "telegram_manual_price",
    priceSource: input.priceSource,
    confidence: input.confidence,
    lastVerifiedAt: input.lastVerifiedAt,
    previousPrice: outlier.previousPrice,
    changePercent: outlier.changePercent,
    isOutlier: outlier.isOutlier,
    outlierMessage: outlier.message,
  } satisfies Prisma.InputJsonObject;
}

export function extractTelegramPriceUpdateHistoryRow(transaction: {
  id: string;
  occurredAt: Date;
  unitPrice: Prisma.Decimal | null;
  currency: string | null;
  notes: string | null;
  metadata: Prisma.JsonValue | null;
}): SaasTelegramGiftPriceHistoryRow {
  const metadata = toJsonRecord(transaction.metadata);

  return {
    id: transaction.id,
    occurredAt: transaction.occurredAt.toISOString(),
    price: decimalToNumber(transaction.unitPrice),
    currency: transaction.currency,
    confidence: normalizeConfidence(metadata.confidence),
    priceSource: normalizeTelegramPriceSource(metadata.priceSource),
    lastVerifiedAt: typeof metadata.lastVerifiedAt === "string" ? metadata.lastVerifiedAt : null,
    notes: transaction.notes,
    previousPrice:
      typeof metadata.previousPrice === "number" ||
      typeof metadata.previousPrice === "string"
        ? decimalToNumber(metadata.previousPrice)
        : null,
    changePercent:
      typeof metadata.changePercent === "number"
        ? metadata.changePercent
        : typeof metadata.changePercent === "string"
          ? decimalToNumber(metadata.changePercent)
          : null,
    isOutlier: metadata.isOutlier === true,
    outlierMessage: typeof metadata.outlierMessage === "string" ? metadata.outlierMessage : null,
  };
}

export function deriveTelegramGiftReviewState(options: {
  currentPrice: number | null;
  confidence: SaasManualAssetConfidence | null;
  lastVerifiedAt: string | null;
}): { needsReview: boolean; reviewReason: string | null } {
  if (options.currentPrice === null) {
    return {
      needsReview: true,
      reviewReason: "Для подарка еще не задана OTC/manual цена.",
    };
  }

  if (isTimestampStale(options.lastVerifiedAt, getManualStaleAfterMs("telegram"))) {
    return {
      needsReview: true,
      reviewReason: "Цена давно не подтверждалась. Нужен новый manual review.",
    };
  }

  if (options.confidence === "low") {
    return {
      needsReview: true,
      reviewReason: "Текущий quote помечен как low confidence.",
    };
  }

  return {
    needsReview: false,
    reviewReason: null,
  };
}

export function buildTelegramGiftPricingRow(options: {
  position: {
    id: string;
    assetId: string;
    assetName: string;
    quantity: number;
    manualCurrentPrice: number | null;
    currentPrice: number | null;
    currency: string | null;
    totalValue: number;
    confidence: SaasManualAssetConfidence | null;
    manualPriceSource: SaasTelegramPriceSource | null;
    lastVerifiedAt: string | null;
    priceNotes: string | null;
  };
  baseCurrency: string;
  history: SaasTelegramGiftPriceHistoryRow[];
}): SaasTelegramGiftPricingRow {
  const currentPrice = options.position.manualCurrentPrice ?? options.position.currentPrice;
  const reviewState = deriveTelegramGiftReviewState({
    currentPrice,
    confidence: options.position.confidence,
    lastVerifiedAt: options.position.lastVerifiedAt,
  });
  const latestOutlier = options.history.find((entry) => entry.isOutlier) ?? null;

  return {
    positionId: options.position.id,
    assetId: options.position.assetId,
    assetName: options.position.assetName,
    quantity: options.position.quantity,
    currentPrice,
    currency: options.position.currency ?? options.baseCurrency,
    totalValue: options.position.totalValue,
    confidence: options.position.confidence,
    priceSource: options.position.manualPriceSource,
    lastVerifiedAt: options.position.lastVerifiedAt,
    notes: options.position.priceNotes,
    needsReview: reviewState.needsReview,
    reviewReason: reviewState.reviewReason,
    latestOutlierMessage: latestOutlier?.outlierMessage ?? null,
    history: options.history,
  };
}

export async function updateTelegramGiftPrice(
  userId: string,
  portfolioId: string,
  positionId: string,
  input: TelegramGiftPriceUpdateInput,
): Promise<TelegramGiftPriceUpdateResult> {
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
      throw new Error("Telegram gift position was not found or was already removed.");
    }

    if (currentPosition.asset.category !== "TELEGRAM") {
      throw new Error("Price updates via this flow are available only for Telegram Gifts.");
    }

    const latestPriceUpdate = await transaction.transaction.findFirst({
      where: {
        portfolioId,
        assetId: currentPosition.assetId,
        action: "PRICE_UPDATE",
      },
      orderBy: [{ occurredAt: "desc" }],
      select: {
        unitPrice: true,
      },
    });

    const previousPrice =
      decimalToNumber(latestPriceUpdate?.unitPrice) ??
      decimalToNumber(currentPosition.manualCurrentPrice) ??
      decimalToNumber(currentPosition.currentPrice) ??
      decimalToNumber(currentPosition.averageEntryPrice);

    const outlier = buildOutlierResult(previousPrice, input.price);
    const editedAt = new Date().toISOString();

    await transaction.position.update({
      where: {
        id: positionId,
      },
      data: {
        manualCurrentPrice: String(input.price),
        priceSource: "MANUAL",
        metadata: buildTelegramPositionMetadata(currentPosition.metadata, input, editedAt, outlier),
      },
    });

    const priceUpdate = await transaction.transaction.create({
      data: {
        portfolioId,
        assetId: currentPosition.assetId,
        action: "PRICE_UPDATE",
        occurredAt: new Date(editedAt),
        quantity: null,
        unitPrice: String(input.price),
        currency: input.currency,
        notes: input.notes ?? null,
        metadata: buildPriceUpdateMetadata(input, outlier),
      },
    });

    await transaction.auditLog.create({
      data: {
        workspaceId: membership.workspaceId,
        portfolioId,
        userId,
        actorType: "USER",
        action: "telegram.price_update",
        entityType: "position",
        entityId: currentPosition.id,
        severity: outlier.isOutlier ? "WARNING" : "INFO",
        message: outlier.isOutlier
          ? `Updated Telegram Gift price with outlier warning (${formatTelegramPriceSourceLabel(input.priceSource)}).`
          : `Updated Telegram Gift price from ${formatTelegramPriceSourceLabel(input.priceSource)}.`,
        payload: {
          assetId: currentPosition.assetId,
          assetName: currentPosition.asset.name,
          priceSource: input.priceSource,
          confidence: input.confidence,
          previousPrice: outlier.previousPrice,
          currentPrice: input.price,
          changePercent: outlier.changePercent,
          isOutlier: outlier.isOutlier,
          lastVerifiedAt: input.lastVerifiedAt,
          transactionId: priceUpdate.id,
        },
      },
    });

    return {
      action: "price_updated",
      positionId: currentPosition.id,
      assetId: currentPosition.assetId,
      transactionId: priceUpdate.id,
      previousPrice: outlier.previousPrice,
      currentPrice: input.price,
      changePercent: outlier.changePercent,
      isOutlier: outlier.isOutlier,
      outlierMessage: outlier.message,
    };
  });
}


