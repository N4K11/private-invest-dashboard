import { remember } from "@/lib/cache/ttl-store";
import { COINGECKO_SYMBOL_MAP } from "@/lib/constants";
import { getEnv } from "@/lib/env";
import { computeMoneyMetrics } from "@/lib/portfolio/metrics";
import type { TelegramGiftResolvedPriceQuote, TelegramGiftPriceLookupInput, TelegramGiftPriceProvider } from "@/lib/providers/telegram-gifts/types";
import type { NormalizedTelegramGiftRow } from "@/lib/sheets/normalizers";
import type { TelegramGiftPosition, TelegramPriceConfidence } from "@/types/portfolio";

function sanitizeConfidence(value: string | null | undefined): TelegramPriceConfidence | null {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }

  return null;
}

function getTelegramPriceStaleThresholdMs() {
  return getEnv().TELEGRAM_PRICE_STALE_DAYS * 24 * 60 * 60 * 1000;
}

function isTelegramPriceStale(value: string | null) {
  if (!value) {
    return true;
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return true;
  }

  return Date.now() - parsed > getTelegramPriceStaleThresholdMs();
}

function joinWarnings(...items: Array<string | null>) {
  const filtered = items.filter((item): item is string => Boolean(item));
  return filtered.length > 0 ? filtered.join(" ") : null;
}

function buildStaleWarning(lastCheckedAt: string | null) {
  if (!lastCheckedAt) {
    return "Для цены не указана дата последней проверки.";
  }

  if (isTelegramPriceStale(lastCheckedAt)) {
    return "Цена давно не проверялась и требует обновления.";
  }

  return null;
}

async function fetchTonUsdPrice() {
  const env = getEnv();
  const tonId = COINGECKO_SYMBOL_MAP.TON;

  return remember("coingecko:telegram-gifts-ton-usd", env.PRICE_CACHE_TTL_SECONDS * 1000, async () => {
    try {
      const url = new URL("https://api.coingecko.com/api/v3/simple/price");
      url.searchParams.set("ids", tonId);
      url.searchParams.set("vs_currencies", "usd");

      const response = await fetch(url, {
        headers: env.COINGECKO_API_KEY
          ? {
              "x-cg-demo-api-key": env.COINGECKO_API_KEY,
            }
          : undefined,
        next: {
          revalidate: env.PRICE_CACHE_TTL_SECONDS,
        },
      });

      if (!response.ok) {
        throw new Error(`CoinGecko returned ${response.status}`);
      }

      const payload = (await response.json()) as Record<string, { usd?: number }>;
      const price = payload[tonId]?.usd;

      return typeof price === "number" ? price : null;
    } catch {
      return null;
    }
  });
}

function createManualSheetTelegramProvider(): TelegramGiftPriceProvider {
  return {
    id: "manual_sheet",
    sourceName: "Manual Sheet Pricing",
    async getBulkPrices(inputs) {
      const quotes = new Map<string, TelegramGiftResolvedPriceQuote>();

      for (const input of inputs) {
        const price = input.row.currentPrice ?? input.row.manualCurrentPrice ?? null;
        if (price === null) {
          continue;
        }

        const lastCheckedAt = input.row.lastUpdated ?? null;
        quotes.set(input.assetId, {
          assetId: input.assetId,
          assetName: input.assetName,
          price,
          sourceId: input.row.priceSource ?? "manual_sheet",
          sourceName: "Ручная цена из таблицы",
          confidence: sanitizeConfidence(input.row.priceConfidence) ?? "medium",
          sourceNote: input.row.sourceNote ?? "Ручная оценка из Google Sheets.",
          lastCheckedAt,
          warning: buildStaleWarning(lastCheckedAt),
          isStale: isTelegramPriceStale(lastCheckedAt),
        });
      }

      return {
        quotes,
        warnings: [],
      };
    },
  };
}

function createTonSheetTelegramProvider(tonUsdPrice: number | null): TelegramGiftPriceProvider {
  return {
    id: tonUsdPrice !== null ? "ton_sheet_x_coingecko" : "ton_sheet_nominal",
    sourceName: tonUsdPrice !== null ? "TON Sheet x CoinGecko" : "TON Sheet Nominal",
    async getBulkPrices(inputs) {
      const quotes = new Map<string, TelegramGiftResolvedPriceQuote>();

      for (const input of inputs) {
        if (input.row.estimatedPriceQuoteSymbol !== "TON" || input.row.estimatedPrice === null) {
          continue;
        }

        const lastCheckedAt = input.row.lastUpdated ?? null;
        const isStale = isTelegramPriceStale(lastCheckedAt);
        const convertedPrice = tonUsdPrice !== null ? input.row.estimatedPrice * tonUsdPrice : input.row.estimatedPrice;
        const conversionNote = tonUsdPrice !== null
          ? `Оценка из TON с live-конвертацией по курсу ${tonUsdPrice.toFixed(2)} USD.`
          : "Цена сохранена в TON, но live-курс TON/USD сейчас недоступен.";

        quotes.set(input.assetId, {
          assetId: input.assetId,
          assetName: input.assetName,
          price: convertedPrice,
          sourceId: tonUsdPrice !== null ? "ton_sheet_x_coingecko" : "ton_sheet_nominal",
          sourceName: tonUsdPrice !== null ? "TON по live-курсу" : "TON номинал",
          confidence: sanitizeConfidence(input.row.priceConfidence) ?? (tonUsdPrice !== null ? "medium" : "low"),
          sourceNote: input.row.sourceNote ?? conversionNote,
          lastCheckedAt,
          warning: joinWarnings(
            tonUsdPrice === null ? "Live-курс TON/USD недоступен, поэтому используется номинал из таблицы." : null,
            buildStaleWarning(lastCheckedAt),
          ),
          isStale,
        });
      }

      const warnings: string[] = [];
      if (inputs.some((input) => input.row.estimatedPriceQuoteSymbol === "TON") && tonUsdPrice === null) {
        warnings.push(
          "Для Telegram Gifts недоступен live-курс TON/USD. Часть цен показывается в номинале TON до следующего успешного обновления CoinGecko.",
        );
      }

      return {
        quotes,
        warnings,
      };
    },
  };
}

function buildTelegramProviders(tonUsdPrice: number | null) {
  return [createManualSheetTelegramProvider(), createTonSheetTelegramProvider(tonUsdPrice)];
}

export async function resolveTelegramGiftPositions(rows: NormalizedTelegramGiftRow[]) {
  const requiresTonQuote = rows.some(
    (row) => row.estimatedPrice !== null && row.estimatedPriceQuoteSymbol === "TON",
  );
  const tonUsdPrice = requiresTonQuote ? await fetchTonUsdPrice() : null;
  const providers = buildTelegramProviders(tonUsdPrice);
  const lookups: TelegramGiftPriceLookupInput[] = rows.map((row) => ({
    assetId: row.id,
    assetName: row.name,
    row,
  }));
  const quotes = new Map<string, TelegramGiftResolvedPriceQuote>();
  const warnings: string[] = [];
  let unresolved = lookups;

  for (const provider of providers) {
    if (unresolved.length === 0) {
      break;
    }

    const result = await provider.getBulkPrices(unresolved);
    warnings.push(...result.warnings);

    for (const input of unresolved) {
      const quote = result.quotes.get(input.assetId);
      if (quote && quote.price !== null) {
        quotes.set(input.assetId, quote);
      }
    }

    unresolved = unresolved.filter((input) => !quotes.has(input.assetId));
  }

  const positions: TelegramGiftPosition[] = rows.map((row) => {
    const quote = quotes.get(row.id) ?? null;
    const currentPrice = quote?.price ?? null;
    const metrics = computeMoneyMetrics(row.quantity, row.entryPrice ?? null, currentPrice);
    const priceConfidence =
      quote?.confidence ?? sanitizeConfidence(row.priceConfidence) ?? (currentPrice !== null ? "low" : null);
    const priceLastCheckedAt = quote?.lastCheckedAt ?? row.lastUpdated ?? null;
    const isPriceStale = quote?.isStale ?? isTelegramPriceStale(priceLastCheckedAt);
    const priceWarning =
      quote?.warning ??
      (currentPrice === null ? "Для подарка не заполнена актуальная цена." : buildStaleWarning(priceLastCheckedAt));
    const priceSourceNote = quote?.sourceNote ?? row.sourceNote ?? null;

    return {
      id: row.id,
      name: row.name,
      collection: row.collection ?? null,
      quantity: row.quantity,
      quantitySource: "sheet",
      entryPrice: row.entryPrice ?? null,
      averageEntryPrice: row.entryPrice ?? null,
      manualCurrentPrice: row.manualCurrentPrice ?? null,
      currentPrice: row.currentPrice ?? null,
      estimatedPrice: currentPrice,
      totalValue: metrics.totalValue,
      totalCost: metrics.totalCost,
      pnl: metrics.pnl,
      pnlPercent: metrics.pnlPercent,
      realizedPnl: 0,
      unrealizedPnl: metrics.pnl,
      fees: 0,
      transactionCount: 0,
      riskScore: 0,
      priceConfidence,
      priceSourceNote,
      priceLastCheckedAt,
      priceWarning,
      isPriceStale,
      liquidityNote: row.liquidityNote ?? null,
      status: row.status ?? null,
      lastUpdated: row.lastUpdated ?? null,
      notes: row.notes ?? null,
      priceSource: quote?.sourceId ?? row.priceSource ?? "missing",
      rowRef: row.sheetRef,
      portfolioWeight: 0,
      recommendation: "hold",
      riskSummary: "Portfolio risk будет рассчитан после сборки общего snapshot.",
      riskFactors: [],
    };
  });

  const missingCount = positions.filter((position) => position.estimatedPrice === null).length;
  const staleCount = positions.filter((position) => position.isPriceStale).length;
  const lowConfidenceCount = positions.filter((position) => position.priceConfidence === "low").length;
  const tonCount = positions.filter((position) => position.priceSource === "ton_sheet_x_coingecko").length;

  if (tonCount > 0) {
    warnings.push(`Telegram Gifts с live-конвертацией TON/USD: ${tonCount}.`);
  }

  if (lowConfidenceCount > 0) {
    warnings.push(`У ${lowConfidenceCount} подарков Telegram низкая уверенность в цене.`);
  }

  if (staleCount > 0) {
    warnings.push(`У ${staleCount} подарков Telegram цена давно не обновлялась.`);
  }

  if (missingCount > 0) {
    warnings.push(`У ${missingCount} подарков Telegram цена отсутствует.`);
  }

  return {
    positions,
    warnings,
  };
}

