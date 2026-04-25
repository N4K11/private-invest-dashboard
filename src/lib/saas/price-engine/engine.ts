import "server-only";

import { Prisma } from "@prisma/client";

import { getPrismaClient } from "@/lib/db/client";
import {
  getPriceRefreshWindowMs,
  getWorkspaceLimitSnapshot,
} from "@/lib/saas/limits";
import { createSaasCryptoPriceProvider } from "@/lib/saas/price-engine/providers/crypto-provider";
import { createSaasCs2PriceProvider } from "@/lib/saas/price-engine/providers/cs2-provider";
import { createSaasCustomPriceProvider } from "@/lib/saas/price-engine/providers/custom-provider";
import { createSaasTelegramPriceProvider } from "@/lib/saas/price-engine/providers/telegram-provider";
import type {
  SaasPortfolioPriceEngineResult,
  SaasPriceEnginePositionInput,
  SaasPriceProvider,
  SaasResolvedPriceQuote,
} from "@/lib/saas/price-engine/types";
import { decimalToNumber } from "@/lib/saas/utils";
import type { SaasWorkspaceLimitSnapshot } from "@/types/saas";

type LatestSnapshotRow = {
  assetId: string;
  capturedAt: Date;
  currency: string;
  price: Prisma.Decimal;
  source: SaasResolvedPriceQuote["snapshotSource"];
  confidence: string | null;
  metadata: Prisma.JsonValue | null;
};

function getSaasPriceProviders(): SaasPriceProvider[] {
  return [
    createSaasCryptoPriceProvider(),
    createSaasCs2PriceProvider(),
    createSaasTelegramPriceProvider(),
    createSaasCustomPriceProvider(),
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toJsonRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function normalizeConfidenceStatus(value: unknown): SaasResolvedPriceQuote["confidenceStatus"] {
  return value === "live_high" ||
    value === "live_medium" ||
    value === "manual_high" ||
    value === "manual_low" ||
    value === "stale" ||
    value === "unknown"
    ? value
    : "unknown";
}

function normalizeLiquidityEstimate(
  value: unknown,
): SaasResolvedPriceQuote["liquidityEstimate"] {
  return value === "high" ||
    value === "medium" ||
    value === "low" ||
    value === "unknown"
    ? value
    : null;
}

function formatRefreshHours(hours: number | null) {
  if (hours === null) {
    return null;
  }

  return Number.isInteger(hours) ? `${hours}` : hours.toFixed(1);
}

function buildSourceLabel(
  source: LatestSnapshotRow["source"],
  metadata: Record<string, unknown>,
) {
  if (typeof metadata.sourceLabel === "string" && metadata.sourceLabel.trim().length > 0) {
    return metadata.sourceLabel.trim();
  }

  return String(source).toLowerCase().replace(/_/g, " ");
}

function buildSnapshotWarning(options: {
  existingWarning: string | null;
  refreshHours: number | null;
}) {
  const refreshHours = formatRefreshHours(options.refreshHours);
  const reuseWarning = refreshHours
    ? `Quote взят из свежего snapshot внутри plan gate (${refreshHours}ч).`
    : null;

  if (options.existingWarning && reuseWarning) {
    return `${options.existingWarning} ${reuseWarning}`;
  }

  return options.existingWarning ?? reuseWarning;
}

function mapSnapshotToQuote(options: {
  position: SaasPriceEnginePositionInput;
  snapshot: LatestSnapshotRow;
  refreshHours: number | null;
}): SaasResolvedPriceQuote {
  const metadata = toJsonRecord(options.snapshot.metadata);
  const details = toStringArray(metadata.details);
  const existingWarning =
    typeof metadata.warning === "string" && metadata.warning.trim().length > 0
      ? metadata.warning.trim()
      : null;
  const warning = buildSnapshotWarning({
    existingWarning,
    refreshHours: options.refreshHours,
  });

  if (warning && !details.includes("Snapshot reused due to plan refresh window.")) {
    details.push("Snapshot reused due to plan refresh window.");
  }

  return {
    positionId: options.position.positionId,
    assetId: options.position.assetId,
    category: options.position.category,
    price: decimalToNumber(options.snapshot.price),
    currency: options.snapshot.currency || options.position.baseCurrency,
    sourceId:
      typeof metadata.sourceId === "string" && metadata.sourceId.trim().length > 0
        ? metadata.sourceId.trim()
        : String(options.snapshot.source).toLowerCase(),
    sourceLabel: buildSourceLabel(options.snapshot.source, metadata),
    snapshotSource: options.snapshot.source,
    confidenceStatus: normalizeConfidenceStatus(options.snapshot.confidence),
    isLive: metadata.isLive !== false,
    ttlSeconds:
      typeof metadata.providerTtlSeconds === "number"
        ? metadata.providerTtlSeconds
        : typeof metadata.providerTtlSeconds === "string" && Number.isFinite(Number(metadata.providerTtlSeconds))
          ? Number(metadata.providerTtlSeconds)
          : 0,
    capturedAt: options.snapshot.capturedAt.toISOString(),
    lastUpdated:
      typeof metadata.lastUpdated === "string" && metadata.lastUpdated.trim().length > 0
        ? metadata.lastUpdated.trim()
        : options.snapshot.capturedAt.toISOString(),
    warning,
    details,
    liquidityEstimate: normalizeLiquidityEstimate(metadata.liquidityEstimate),
    metadata,
  };
}

async function fetchLatestSnapshots(
  portfolioId: string,
  assetIds: string[],
) {
  if (assetIds.length === 0) {
    return new Map<string, LatestSnapshotRow>();
  }

  const prisma = getPrismaClient();
  const rows = await prisma.priceSnapshot.findMany({
    where: {
      portfolioId,
      assetId: {
        in: assetIds,
      },
    },
    orderBy: [{ capturedAt: "desc" }],
    select: {
      assetId: true,
      capturedAt: true,
      currency: true,
      price: true,
      source: true,
      confidence: true,
      metadata: true,
    },
  });

  const latestByAssetId = new Map<string, LatestSnapshotRow>();
  for (const row of rows) {
    if (!latestByAssetId.has(row.assetId)) {
      latestByAssetId.set(row.assetId, row);
    }
  }

  return latestByAssetId;
}

async function persistPriceSnapshots(
  portfolioId: string,
  quotes: SaasResolvedPriceQuote[],
) {
  const snapshotRows = quotes
    .filter((quote) => quote.price !== null && quote.capturedAt)
    .map((quote) => ({
      portfolioId,
      assetId: quote.assetId,
      capturedAt: new Date(quote.capturedAt ?? new Date().toISOString()),
      currency: quote.currency,
      price: new Prisma.Decimal(quote.price ?? 0),
      source: quote.snapshotSource,
      confidence: quote.confidenceStatus,
      metadata: {
        ...(quote.metadata ?? {}),
        sourceId: quote.sourceId,
        sourceLabel: quote.sourceLabel,
        isLive: quote.isLive,
        warning: quote.warning,
        details: quote.details,
        providerTtlSeconds: quote.ttlSeconds,
        lastUpdated: quote.lastUpdated,
        liquidityEstimate: quote.liquidityEstimate,
      },
    }));

  if (snapshotRows.length === 0) {
    return 0;
  }

  const prisma = getPrismaClient();
  const result = await prisma.priceSnapshot.createMany({
    data: snapshotRows,
    skipDuplicates: true,
  });

  return result.count;
}

export async function resolveSaasPortfolioPrices(options: {
  portfolioId: string;
  workspaceId: string;
  positions: SaasPriceEnginePositionInput[];
  limitSnapshot?: SaasWorkspaceLimitSnapshot;
}): Promise<SaasPortfolioPriceEngineResult> {
  const limitSnapshot =
    options.limitSnapshot ?? (await getWorkspaceLimitSnapshot(options.workspaceId));
  const refreshWindowMs = limitSnapshot ? getPriceRefreshWindowMs(limitSnapshot) : null;
  const refreshHours = limitSnapshot?.effectiveLimits.priceRefreshHours ?? null;
  const quotes = new Map<string, SaasResolvedPriceQuote>();
  const warnings = new Set<string>();
  let cachedQuoteCount = 0;

  const latestSnapshots =
    refreshWindowMs !== null && refreshWindowMs > 0
      ? await fetchLatestSnapshots(
          options.portfolioId,
          [...new Set(options.positions.map((position) => position.assetId))],
        )
      : new Map<string, LatestSnapshotRow>();

  const providerInputs: SaasPriceEnginePositionInput[] = [];
  for (const position of options.positions) {
    const snapshot = latestSnapshots.get(position.assetId);
    const snapshotAgeMs = snapshot
      ? Date.now() - snapshot.capturedAt.getTime()
      : Number.POSITIVE_INFINITY;

    if (
      snapshot &&
      refreshWindowMs !== null &&
      refreshWindowMs > 0 &&
      snapshotAgeMs <= refreshWindowMs &&
      decimalToNumber(snapshot.price) !== null
    ) {
      quotes.set(
        position.positionId,
        mapSnapshotToQuote({
          position,
          snapshot,
          refreshHours,
        }),
      );
      cachedQuoteCount += 1;
      continue;
    }

    providerInputs.push(position);
  }

  const providers = getSaasPriceProviders();
  for (const provider of providers) {
    const scopedInputs = providerInputs.filter((position) =>
      provider.categories.includes(position.category),
    );
    if (scopedInputs.length === 0) {
      continue;
    }

    const result = await provider.resolve(scopedInputs);
    for (const warning of result.warnings) {
      warnings.add(warning);
    }

    for (const [positionId, quote] of result.quotes.entries()) {
      quotes.set(positionId, quote);
    }
  }

  const liveQuotes = [...quotes.values()].filter(
    (quote) => !quote.details.includes("Snapshot reused due to plan refresh window."),
  );
  const persistedSnapshots = await persistPriceSnapshots(options.portfolioId, liveQuotes);

  if (cachedQuoteCount > 0 && refreshHours !== null) {
    warnings.add(
      `Plan refresh gate переиспользовал ${cachedQuoteCount} recent quotes (окно ${formatRefreshHours(refreshHours)}ч).`,
    );
  }

  return {
    quotes,
    warnings: [...warnings],
    persistedSnapshots,
  };
}