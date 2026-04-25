import "server-only";

import type {
  PortfolioInsightsProvider,
  SafePortfolioInsightPosition,
  SafePortfolioInsightsContext,
  SafePortfolioInsightSnapshot,
} from "@/lib/saas/insights/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import type {
  SaasAssetCategory,
  SaasPortfolioInsightCategory,
  SaasPortfolioInsightItem,
  SaasPortfolioInsightSection,
  SaasPortfolioInsightTone,
} from "@/types/saas";

const CATEGORY_LABELS: Record<SaasAssetCategory, string> = {
  cs2: "CS2",
  telegram: "Telegram Gifts",
  crypto: "Крипта",
  custom: "Custom",
  nft: "NFT",
};

function formatShare(value: number) {
  return `${Math.abs(value) < 0.05 ? value.toFixed(2) : value.toFixed(1)}%`;
}

function formatSignedCurrency(value: number, currency: string) {
  const formatted = formatCurrency(Math.abs(value), currency, 2);
  if (value > 0) {
    return `+${formatted}`;
  }

  if (value < 0) {
    return `-${formatted}`;
  }

  return formatCurrency(0, currency, 2);
}

function formatSignedPercent(value: number | null) {
  return formatPercent(value, 1);
}

function buildItem(params: {
  id: string;
  category: SaasPortfolioInsightCategory;
  tone: SaasPortfolioInsightTone;
  title: string;
  summary: string;
  details?: string[];
  metrics?: { label: string; value: string }[];
}): SaasPortfolioInsightItem {
  return {
    id: params.id,
    category: params.category,
    tone: params.tone,
    title: params.title,
    summary: params.summary,
    details: params.details ?? [],
    metrics: params.metrics ?? [],
  };
}

function getPositionsByCategory(context: SafePortfolioInsightsContext) {
  const totals = new Map<SaasAssetCategory, number>();

  for (const position of context.positions) {
    totals.set(position.category, (totals.get(position.category) ?? 0) + position.totalValue);
  }

  return [...totals.entries()]
    .map(([category, value]) => ({
      category,
      label: CATEGORY_LABELS[category],
      value,
      weight: context.totalValue > 0 ? (value / context.totalValue) * 100 : 0,
    }))
    .sort((left, right) => right.value - left.value);
}

function getLiquidityWeight(context: SafePortfolioInsightsContext, positions: SafePortfolioInsightPosition[]) {
  const totalValue = positions.reduce((sum, position) => sum + position.totalValue, 0);
  return context.totalValue > 0 ? (totalValue / context.totalValue) * 100 : 0;
}

function getConcentrationTone(maxPositionWeight: number, topThreeWeight: number): SaasPortfolioInsightTone {
  if (maxPositionWeight >= 25 || topThreeWeight >= 65) {
    return "critical";
  }

  if (maxPositionWeight >= 15 || topThreeWeight >= 50) {
    return "warning";
  }

  return "positive";
}

function getWatchlistTone(position: SafePortfolioInsightsContext["analytics"]["riskWatchlist"][number]): SaasPortfolioInsightTone {
  if (
    position.riskFlags.includes("missing_price") ||
    (position.riskFlags.includes("concentration") && position.weight >= 20)
  ) {
    return "critical";
  }

  if (
    position.riskFlags.includes("stale_price") ||
    position.riskFlags.includes("low_liquidity") ||
    position.riskFlags.includes("negative_pnl") ||
    position.riskFlags.includes("low_confidence")
  ) {
    return "warning";
  }

  return "neutral";
}

function getHeadline(context: SafePortfolioInsightsContext) {
  const unknownCount = context.positions.filter(
    (position) => position.priceConfidenceStatus === "unknown",
  ).length;

  if (context.positionCount === 0) {
    return "Портфель пока пуст: инсайты появятся после первых импортов или ручных позиций.";
  }

  if (unknownCount >= Math.max(2, Math.ceil(context.positionCount / 3))) {
    return "Заметная часть оценки сейчас неполная: сначала стоит закрыть пробелы по ценам, а уже потом читать выводы по доходности.";
  }

  if (context.analytics.concentrationRisk.maxPositionWeight >= 25) {
    return "Главный риск сейчас в концентрации: одна крупная позиция заметно двигает весь портфель.";
  }

  if (context.totalPnl > 0) {
    return "Портфель в плюсе, но итог сильнее всего зависит от веса крупнейших позиций и свежести цен.";
  }

  if (context.totalPnl < 0) {
    return "Портфель пока ниже cost basis: ключевые сигналы лежат в концентрации, ликвидности и качестве оценки.";
  }

  return "Портфель выглядит относительно ровно, но качество оценки и изменения между snapshots все еще требуют контроля.";
}

function buildSummarySection(context: SafePortfolioInsightsContext): SaasPortfolioInsightSection {
  const categoryBreakdown = getPositionsByCategory(context);
  const dominantCategory = categoryBreakdown[0] ?? null;
  const tone: SaasPortfolioInsightTone =
    context.totalPnl > 0 ? "positive" : context.totalPnl < 0 ? "warning" : "neutral";

  return {
    id: "summary",
    title: "Общий обзор",
    description: "Короткая сводка по стоимости, PnL и доминирующему блоку активов.",
    items: [
      buildItem({
        id: "summary-overview",
        category: "summary",
        tone,
        title: "Текущая картина портфеля",
        summary: `Портфель оценивается в ${formatCurrency(context.totalValue, context.baseCurrency, 2)}. Совокупный PnL сейчас ${formatSignedCurrency(context.totalPnl, context.baseCurrency)}.`,
        details: [
          `Активных позиций: ${formatNumber(context.positionCount, 0)}. Транзакций в ledger: ${formatNumber(context.transactionCount, 0)}.`,
          dominantCategory
            ? `${dominantCategory.label} сейчас крупнейший блок: ${formatCurrency(dominantCategory.value, context.baseCurrency, 2)} (${formatShare(dominantCategory.weight)} портфеля).`
            : "Структура по категориям появится после первых позиций.",
        ],
        metrics: [
          {
            label: "Стоимость",
            value: formatCurrency(context.totalValue, context.baseCurrency, 2),
          },
          {
            label: "PnL",
            value: formatSignedCurrency(context.totalPnl, context.baseCurrency),
          },
          {
            label: "ROI",
            value: formatSignedPercent(context.roi),
          },
        ],
      }),
    ],
  };
}

function buildRiskSection(context: SafePortfolioInsightsContext): SaasPortfolioInsightSection {
  if (context.analytics.riskWatchlist.length === 0) {
    return {
      id: "risk",
      title: "Объяснение риска",
      description: "Deterministic explainability по watchlist и valuation flags.",
      items: [
        buildItem({
          id: "risk-clear",
          category: "risk",
          tone: "positive",
          title: "Явных красных флагов не видно",
          summary: "По текущим правилам watchlist пуст: система не видит крупных позиций с критичным сочетанием концентрации, stale price и low confidence.",
          details: [
            "Это не означает отсутствие риска вообще, а только то, что текущие deterministic rules не подняли явный alert-level сигнал.",
          ],
        }),
      ],
    };
  }

  return {
    id: "risk",
    title: "Объяснение риска",
    description: "Почему система считает отдельные позиции чувствительными для общего результата.",
    items: context.analytics.riskWatchlist.slice(0, 3).map((position) =>
      buildItem({
        id: `risk-${position.positionId}`,
        category: "risk",
        tone: getWatchlistTone(position),
        title: position.assetName,
        summary: `${formatCurrency(position.value, context.baseCurrency, 2)} · ${formatShare(position.weight)} портфеля · PnL ${formatSignedCurrency(position.totalPnl, context.baseCurrency)}.`,
        details:
          position.explainability.length > 0
            ? position.explainability.slice(0, 3)
            : ["Позиция попала в watchlist по сочетанию веса, PnL и качества цены."],
        metrics: [
          {
            label: "Доля",
            value: formatShare(position.weight),
          },
          {
            label: "PnL",
            value: formatSignedCurrency(position.totalPnl, context.baseCurrency),
          },
          {
            label: "ROI",
            value: formatSignedPercent(position.roi),
          },
        ],
      }),
    ),
  };
}

function buildLiquiditySection(context: SafePortfolioInsightsContext): SaasPortfolioInsightSection {
  const lowLiquidityPositions = context.positions
    .filter((position) => position.liquidity === "low")
    .sort((left, right) => right.totalValue - left.totalValue);
  const unknownLiquidityCount = context.positions.filter(
    (position) => position.liquidity === null || position.liquidity === "unknown",
  ).length;
  const liquidityShare = getLiquidityWeight(context, lowLiquidityPositions);

  const items: SaasPortfolioInsightItem[] = [];

  if (lowLiquidityPositions.length === 0) {
    items.push(
      buildItem({
        id: "liquidity-clear",
        category: "liquidity",
        tone: unknownLiquidityCount > 0 ? "neutral" : "positive",
        title: "Критичных признаков неликвидности не видно",
        summary:
          unknownLiquidityCount > 0
            ? `Явно low-liquidity позиций сейчас нет, но у ${unknownLiquidityCount} позиций ликвидность пока не размечена.`
            : "По текущей ручной разметке позиции с явным low-liquidity статусом не найдены.",
        details:
          unknownLiquidityCount > 0
            ? ["Добавь liquidity tags для неразмеченных активов, чтобы точнее читать risk-layer."]
            : [],
        metrics: [
          {
            label: "Unknown",
            value: formatNumber(unknownLiquidityCount, 0),
          },
        ],
      }),
    );
  } else {
    items.push(
      buildItem({
        id: "liquidity-warning",
        category: "liquidity",
        tone: liquidityShare >= 25 ? "critical" : "warning",
        title: "Есть позиции с низкой ликвидностью",
        summary: `${formatNumber(lowLiquidityPositions.length, 0)} позиций отмечены как low liquidity и занимают ${formatShare(liquidityShare)} портфеля.`,
        details: lowLiquidityPositions.slice(0, 3).map(
          (position) => `${position.assetName}: ${formatCurrency(position.totalValue, context.baseCurrency, 2)} текущей стоимости.`,
        ),
        metrics: [
          {
            label: "Позиций",
            value: formatNumber(lowLiquidityPositions.length, 0),
          },
          {
            label: "Доля",
            value: formatShare(liquidityShare),
          },
          {
            label: "Unknown",
            value: formatNumber(unknownLiquidityCount, 0),
          },
        ],
      }),
    );
  }

  if (unknownLiquidityCount >= 5) {
    items.push(
      buildItem({
        id: "liquidity-coverage",
        category: "liquidity",
        tone: "neutral",
        title: "Нужно добить покрытие по liquidity labels",
        summary: `У ${unknownLiquidityCount} позиций ликвидность пока не описана, поэтому итоговая risk-картина по выходу из позиции остается частично неполной.`,
        details: [
          "Это особенно важно для OTC и custom активов, где спреды и время выхода обычно не видны по одной цене.",
        ],
      }),
    );
  }

  return {
    id: "liquidity",
    title: "Ликвидность",
    description: "Сигналы по low-liquidity позициям и покрытию ручной разметки.",
    items,
  };
}

function buildConcentrationSection(context: SafePortfolioInsightsContext): SaasPortfolioInsightSection {
  const topPositions = context.analytics.topPositions.slice(0, 3);
  const tone = getConcentrationTone(
    context.analytics.concentrationRisk.maxPositionWeight,
    context.analytics.concentrationRisk.topThreeWeight,
  );

  return {
    id: "concentration",
    title: "Концентрация",
    description: "Насколько сильно общий результат зависит от нескольких крупнейших позиций.",
    items: [
      buildItem({
        id: "concentration-main",
        category: "concentration",
        tone,
        title: "Концентрация капитала",
        summary: context.analytics.concentrationRisk.summary,
        details:
          topPositions.length > 0
            ? topPositions.map(
                (position) => `${position.assetName}: ${formatShare(position.weight)} портфеля и ${formatCurrency(position.value, context.baseCurrency, 2)} текущей стоимости.`,
              )
            : ["Крупные позиции появятся после наполнения портфеля."],
        metrics: [
          {
            label: "Топ 1",
            value: formatShare(context.analytics.concentrationRisk.maxPositionWeight),
          },
          {
            label: "Топ 3",
            value: formatShare(context.analytics.concentrationRisk.topThreeWeight),
          },
        ],
      }),
    ],
  };
}

function getLastTwoEntries<T>(items: T[]) {
  if (items.length < 2) {
    return null;
  }

  return [items[items.length - 2], items[items.length - 1]] as const;
}

function getStrongestAssetClassChange(context: SafePortfolioInsightsContext) {
  const pair = getLastTwoEntries(context.analytics.assetClassHistory);
  if (!pair) {
    return null;
  }

  const [previous, current] = pair;
  const candidates = [
    {
      label: "CS2",
      delta: current.cs2Value - previous.cs2Value,
    },
    {
      label: "Telegram Gifts",
      delta: current.telegramValue - previous.telegramValue,
    },
    {
      label: "Крипта",
      delta: current.cryptoValue - previous.cryptoValue,
    },
    {
      label: "Other",
      delta: (current.otherValue ?? 0) - (previous.otherValue ?? 0),
    },
  ].sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));

  return candidates[0] ?? null;
}

function getLatestSnapshotPairs(snapshots: SafePortfolioInsightSnapshot[]) {
  const byAssetId = new Map<string, SafePortfolioInsightSnapshot[]>();

  for (const snapshot of snapshots) {
    const current = byAssetId.get(snapshot.assetId) ?? [];
    current.push(snapshot);
    byAssetId.set(snapshot.assetId, current);
  }

  const pairs = new Map<string, readonly [SafePortfolioInsightSnapshot, SafePortfolioInsightSnapshot]>();

  for (const [assetId, assetSnapshots] of byAssetId.entries()) {
    const sorted = [...assetSnapshots].sort(
      (left, right) => Date.parse(left.capturedAt) - Date.parse(right.capturedAt),
    );
    const distinct: SafePortfolioInsightSnapshot[] = [];

    for (let index = sorted.length - 1; index >= 0; index -= 1) {
      const candidate = sorted[index]!;
      if (distinct.some((entry) => entry.capturedAt === candidate.capturedAt)) {
        continue;
      }

      distinct.unshift(candidate);
      if (distinct.length === 2) {
        break;
      }
    }

    if (distinct.length === 2) {
      pairs.set(assetId, [distinct[0]!, distinct[1]!]);
    }
  }

  return pairs;
}

function getBigMovers(context: SafePortfolioInsightsContext) {
  const snapshotPairs = getLatestSnapshotPairs(context.snapshots);

  return context.positions
    .map((position) => {
      const pair = snapshotPairs.get(position.assetId);
      if (!pair) {
        return null;
      }

      const [previous, current] = pair;
      const deltaPrice = current.price - previous.price;
      const deltaPercent = previous.price > 0 ? (deltaPrice / previous.price) * 100 : null;
      const estimatedValueImpact = position.quantity * deltaPrice;

      return {
        assetName: position.assetName,
        category: position.category,
        deltaPrice,
        deltaPercent,
        estimatedValueImpact,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) => Math.abs(right.estimatedValueImpact) - Math.abs(left.estimatedValueImpact))
    .slice(0, 3);
}

function buildChangeSection(context: SafePortfolioInsightsContext): SaasPortfolioInsightSection {
  const totalValuePair = getLastTwoEntries(context.analytics.totalValueHistory);
  const totalPnlPair = getLastTwoEntries(context.analytics.totalPnlHistory);
  const strongestClassChange = getStrongestAssetClassChange(context);
  const bigMovers = getBigMovers(context);

  if (!totalValuePair && !totalPnlPair && bigMovers.length === 0) {
    return {
      id: "change",
      title: "Что изменилось с прошлого snapshot",
      description: "Сравнение последних исторических точек без внешнего LLM.",
      items: [
        buildItem({
          id: "change-empty",
          category: "change",
          tone: "neutral",
          title: "История еще не накопилась",
          summary: "Для сравнения нужен минимум один предыдущий snapshot. После накопления истории здесь появятся изменения стоимости, PnL и biggest movers.",
          details: [
            "Текущий блок опирается только на сохраненные price snapshots и transaction-aware analytics.",
          ],
        }),
      ],
    };
  }

  const totalValueDelta = totalValuePair
    ? totalValuePair[1].totalValue - totalValuePair[0].totalValue
    : 0;
  const totalPnlDelta = totalPnlPair ? totalPnlPair[1].totalPnl - totalPnlPair[0].totalPnl : 0;
  const tone: SaasPortfolioInsightTone =
    totalValueDelta > 0 ? "positive" : totalValueDelta < 0 ? "warning" : "neutral";

  const details: string[] = [];
  if (totalPnlPair) {
    details.push(`Совокупный PnL за тот же интервал изменился на ${formatSignedCurrency(totalPnlDelta, context.baseCurrency)}.`);
  }
  if (strongestClassChange && Math.abs(strongestClassChange.delta) > 0) {
    details.push(
      `${strongestClassChange.label} изменился сильнее всего: ${formatSignedCurrency(strongestClassChange.delta, context.baseCurrency)} между двумя последними snapshots.`,
    );
  }
  for (const mover of bigMovers) {
    details.push(
      `${mover.assetName}: ${mover.deltaPercent !== null ? formatSignedPercent(mover.deltaPercent) : formatSignedCurrency(mover.deltaPrice, context.baseCurrency)} по цене между двумя последними snapshots, ориентир изменения стоимости ${formatSignedCurrency(mover.estimatedValueImpact, context.baseCurrency)}.`,
    );
  }

  return {
    id: "change",
    title: "Что изменилось с прошлого snapshot",
    description: "Сравнение последних исторических точек по стоимости, PnL и biggest movers.",
    items: [
      buildItem({
        id: "change-main",
        category: "change",
        tone,
        title: "Последний срез против предыдущего",
        summary: totalValuePair
          ? `Со времени прошлого snapshot стоимость портфеля изменилась на ${formatSignedCurrency(totalValueDelta, context.baseCurrency)}.`
          : "История общей стоимости пока недостаточна, но snapshots по отдельным активам уже можно сравнивать.",
        details,
        metrics: [
          {
            label: "Delta value",
            value: totalValuePair
              ? formatSignedCurrency(totalValueDelta, context.baseCurrency)
              : "—",
          },
          {
            label: "Delta PnL",
            value: totalPnlPair
              ? formatSignedCurrency(totalPnlDelta, context.baseCurrency)
              : "—",
          },
        ],
      }),
    ],
  };
}

function buildValuationSection(context: SafePortfolioInsightsContext): SaasPortfolioInsightSection {
  const unknownPositions = context.positions
    .filter((position) => position.priceConfidenceStatus === "unknown")
    .sort((left, right) => right.totalValue - left.totalValue);
  const stalePositions = context.positions
    .filter((position) => position.priceConfidenceStatus === "stale")
    .sort((left, right) => right.totalValue - left.totalValue);
  const lowConfidencePositions = context.positions
    .filter((position) => position.priceConfidenceStatus === "manual_low")
    .sort((left, right) => right.totalValue - left.totalValue);

  const tone: SaasPortfolioInsightTone =
    unknownPositions.length > 0
      ? "critical"
      : context.analytics.stalePriceCount > 0 || context.analytics.lowConfidenceValuationCount > 0
        ? "warning"
        : "positive";

  const details = [
    ...unknownPositions.slice(0, 2).map(
      (position) => `${position.assetName}: цена не найдена, поэтому вклад позиции в valuation может быть неполным.`,
    ),
    ...stalePositions.slice(0, 2).map(
      (position) => `${position.assetName}: последняя ручная цена устарела, стоит обновить quote.`,
    ),
    ...lowConfidencePositions.slice(0, 2).map(
      (position) => `${position.assetName}: текущий quote помечен как low confidence.`,
    ),
  ];

  if (details.length === 0) {
    details.push("По текущим правилам весь valuation layer выглядит свежим и без явных confidence-пробелов.");
  }

  return {
    id: "valuation",
    title: "Качество оценки",
    description: "Свежесть цен, low-confidence quotes и пропуски в valuation layer.",
    items: [
      buildItem({
        id: "valuation-main",
        category: "valuation",
        tone,
        title: "Насколько надежна текущая оценка",
        summary:
          tone === "positive"
            ? "Существенных пробелов по текущим ценам не видно: valuation layer выглядит достаточно устойчиво для базового анализа."
            : `Сейчас в valuation есть ${formatNumber(unknownPositions.length, 0)} unknown, ${formatNumber(context.analytics.stalePriceCount, 0)} stale и ${formatNumber(context.analytics.lowConfidenceValuationCount, 0)} low-confidence сигналов.`,
        details,
        metrics: [
          {
            label: "Unknown",
            value: formatNumber(unknownPositions.length, 0),
          },
          {
            label: "Stale",
            value: formatNumber(context.analytics.stalePriceCount, 0),
          },
          {
            label: "Low confidence",
            value: formatNumber(context.analytics.lowConfidenceValuationCount, 0),
          },
        ],
      }),
    ],
  };
}

export const deterministicPortfolioInsightsProvider: PortfolioInsightsProvider = {
  id: "deterministic_v1",
  async buildInsights(context) {
    return {
      providerId: this.id,
      deterministic: true,
      generatedAt: context.generatedAt,
      headline: getHeadline(context),
      disclaimer:
        "Это не финансовая рекомендация. Блок Insights описывает текущие структурные сигналы и качество данных, а не советует покупать, продавать или удерживать активы.",
      sections: [
        buildSummarySection(context),
        buildRiskSection(context),
        buildLiquiditySection(context),
        buildConcentrationSection(context),
        buildChangeSection(context),
        buildValuationSection(context),
      ],
    };
  },
};