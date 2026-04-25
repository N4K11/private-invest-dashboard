import "server-only";

import { Prisma } from "@prisma/client";

import { getPrismaClient } from "@/lib/db/client";
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

function getSaasPriceProviders(): SaasPriceProvider[] {
  return [
    createSaasCryptoPriceProvider(),
    createSaasCs2PriceProvider(),
    createSaasTelegramPriceProvider(),
    createSaasCustomPriceProvider(),
  ];
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
  positions: SaasPriceEnginePositionInput[];
}): Promise<SaasPortfolioPriceEngineResult> {
  const providers = getSaasPriceProviders();
  const quotes = new Map<string, SaasResolvedPriceQuote>();
  const warnings: string[] = [];

  for (const provider of providers) {
    const providerInputs = options.positions.filter((position) => provider.categories.includes(position.category));
    if (providerInputs.length === 0) {
      continue;
    }

    const result = await provider.resolve(providerInputs);
    warnings.push(...result.warnings);

    for (const [positionId, quote] of result.quotes.entries()) {
      quotes.set(positionId, quote);
    }
  }

  const persistedSnapshots = await persistPriceSnapshots(options.portfolioId, [...quotes.values()]);

  return {
    quotes,
    warnings,
    persistedSnapshots,
  };
}
