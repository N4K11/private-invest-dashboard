import { remember } from "@/lib/cache/ttl-store";
import {
  computeMoneyMetrics,
  deriveCs2RiskScore,
  riskScoreToLiquidityLabel,
} from "@/lib/portfolio/metrics";
import type { NormalizedCs2Row } from "@/lib/sheets/normalizers";
import type { Cs2Position } from "@/types/portfolio";

type SteamMarketSearchResult = {
  name?: string;
  hash_name?: string;
  sell_price?: number;
  sale_price?: number;
  sell_price_text?: string;
  sale_price_text?: string;
};

type Cs2LiveQuote = {
  matchedName: string | null;
  marketHashName: string | null;
  price: number | null;
  success: boolean;
};

const STEAM_MARKET_TTL_MS = 1000 * 60 * 60 * 6;
const STEAM_MARKET_CONCURRENCY = 14;

function normalizeLiquidityLabel(
  value: string | null,
  fallback: Cs2Position["liquidityLabel"],
): Cs2Position["liquidityLabel"] {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "high" || normalized === "высокая") {
    return "High";
  }

  if (normalized === "medium" || normalized === "средняя") {
    return "Medium";
  }

  if (normalized === "low" || normalized === "низкая") {
    return "Low";
  }

  return fallback;
}

function normalizeMarketText(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[()]/g, " ")
    .replace(/[-–—]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSteamSearchQuery(row: NormalizedCs2Row) {
  const queryBase = row.wear ? `${row.name} ${row.wear}` : row.name;

  return queryBase
    .replace(/[|]/g, " ")
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTargetMarketName(row: NormalizedCs2Row) {
  return row.wear ? `${row.name} (${row.wear})` : row.name;
}

function scoreSteamCandidate(targetName: string, candidateName: string) {
  const normalizedTarget = normalizeMarketText(targetName);
  const normalizedCandidate = normalizeMarketText(candidateName);

  if (!normalizedTarget || !normalizedCandidate) {
    return 0;
  }

  if (normalizedTarget === normalizedCandidate) {
    return 10_000;
  }

  let score = 0;

  if (
    normalizedCandidate.includes(normalizedTarget) ||
    normalizedTarget.includes(normalizedCandidate)
  ) {
    score += 2_000;
  }

  const targetTokens = normalizedTarget.split(" ");
  const candidateTokens = new Set(normalizedCandidate.split(" "));
  const sharedTokenCount = targetTokens.filter((token) => candidateTokens.has(token)).length;

  score += sharedTokenCount * 140;
  score -= Math.abs(targetTokens.length - candidateTokens.size) * 20;

  return score;
}

async function fetchSteamQuote(row: NormalizedCs2Row): Promise<Cs2LiveQuote> {
  const targetName = buildTargetMarketName(row);
  const query = buildSteamSearchQuery(row);

  return remember(`cs2:steam:${query}`, STEAM_MARKET_TTL_MS, async () => {
    const url = new URL("https://steamcommunity.com/market/search/render/");
    url.searchParams.set("query", query);
    url.searchParams.set("appid", "730");
    url.searchParams.set("norender", "1");
    url.searchParams.set("count", "12");
    url.searchParams.set("l", "russian");
    url.searchParams.set("cc", "US");

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        },
        signal: AbortSignal.timeout(7000),
        next: {
          revalidate: Math.floor(STEAM_MARKET_TTL_MS / 1000),
        },
      });

      if (!response.ok) {
        throw new Error(`Steam returned ${response.status}`);
      }

      const payload = (await response.json()) as {
        success?: boolean;
        results?: SteamMarketSearchResult[];
      };
      const results = payload.results ?? [];

      if (!payload.success || results.length === 0) {
        return {
          matchedName: null,
          marketHashName: null,
          price: null,
          success: false,
        };
      }

      const bestMatch = [...results]
        .map((candidate) => ({
          candidate,
          score: scoreSteamCandidate(targetName, candidate.name ?? ""),
        }))
        .sort((left, right) => right.score - left.score)[0];

      const bestCandidate = bestMatch?.candidate;
      const bestPrice =
        typeof bestCandidate?.sell_price === "number"
          ? bestCandidate.sell_price / 100
          : typeof bestCandidate?.sale_price === "number"
            ? bestCandidate.sale_price / 100
            : null;

      if (!bestCandidate || bestMatch.score < 180) {
        return {
          matchedName: null,
          marketHashName: null,
          price: null,
          success: false,
        };
      }

      return {
        matchedName: bestCandidate.name ?? null,
        marketHashName: bestCandidate.hash_name ?? null,
        price: bestPrice,
        success: bestPrice !== null,
      };
    } catch {
      return {
        matchedName: null,
        marketHashName: null,
        price: null,
        success: false,
      };
    }
  });
}

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  mapper: (item: TInput, index: number) => Promise<TOutput>,
) {
  const results = new Array<TOutput>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const currentIndex = cursor;
      cursor += 1;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
}

export async function resolveCs2Positions(rows: NormalizedCs2Row[]) {
  const liveQuotes = await mapWithConcurrency(rows, STEAM_MARKET_CONCURRENCY, (row) =>
    fetchSteamQuote(row),
  );

  const provisional = rows.map((row, index) => {
    const liveQuote = liveQuotes[index];
    const resolvedCurrentPrice = liveQuote.price ?? row.currentPrice ?? row.averageEntryPrice ?? null;
    const metrics = computeMoneyMetrics(
      row.quantity,
      row.averageEntryPrice,
      resolvedCurrentPrice,
    );

    return {
      row,
      liveQuote,
      currentPrice: resolvedCurrentPrice,
      totalValue: metrics.totalValue,
      totalCost: metrics.totalCost,
      pnl: metrics.pnl,
      pnlPercent: metrics.pnlPercent,
    };
  });

  const totalCs2Value = provisional.reduce((sum, item) => sum + item.totalValue, 0);

  const positions: Cs2Position[] = provisional.map((item) => {
    const concentrationShare = totalCs2Value > 0 ? item.totalValue / totalCs2Value : 0;

    const riskScore = deriveCs2RiskScore({
      type: item.row.type,
      totalValue: item.totalValue,
      currentPrice: item.currentPrice,
      quantity: item.row.quantity,
      notes: item.row.notes,
      concentrationShare,
      manualRiskScore: item.row.manualRiskScore,
    });

    const fallbackLiquidity = riskScoreToLiquidityLabel(riskScore);

    return {
      id: item.row.id,
      name: item.row.name,
      type: item.row.type,
      category: item.row.category ?? null,
      quantity: item.row.quantity,
      quantitySource: "sheet",
      averageEntryPrice: item.row.averageEntryPrice,
      manualCurrentPrice: item.row.manualCurrentPrice ?? item.row.currentPrice,
      currentPrice: item.currentPrice,
      totalValue: item.totalValue,
      totalCost: item.totalCost,
      pnl: item.pnl,
      pnlPercent: item.pnlPercent,
      realizedPnl: 0,
      unrealizedPnl: item.pnl,
      fees: 0,
      transactionCount: 0,
      riskScore,
      liquidityLabel: normalizeLiquidityLabel(item.row.liquidityLabel, fallbackLiquidity),
      priceSource: item.liveQuote.success
        ? "steam_market_live"
        : item.row.currentPrice !== null
          ? item.row.sheetPriceSource ?? "manual_sheet"
          : "entry_price_fallback",
      market: item.liveQuote.success ? "Steam Community Market" : item.row.market,
      status: item.row.status ?? null,
      lastUpdated: item.row.lastUpdated ?? null,
      notes: item.row.notes,
      rowRef: item.row.sheetRef,
      isPriceEstimated: item.liveQuote.price === null && item.row.currentPrice === null,
    };
  });

  const liveCount = liveQuotes.filter((quote) => quote.success).length;
  const unresolvedCount = rows.length - liveCount;
  const warnings: string[] = [];

  if (liveCount > 0) {
    warnings.push(
      `Steam Market обновил live-цены для ${liveCount} CS2-позиций из ${rows.length}.`,
    );
  }

  if (unresolvedCount > 0) {
    warnings.push(
      `Для ${unresolvedCount} CS2-позиций Steam Market не дал точное совпадение. Они используют цену из таблицы или остаются без оценки.`,
    );
  }

  return {
    positions,
    warnings,
  };
}
