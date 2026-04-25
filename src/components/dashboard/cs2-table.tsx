"use client";

import { startTransition, useDeferredValue, useMemo, useState } from "react";

import { DashboardStatePanel } from "@/components/dashboard/dashboard-state-panel";
import { RecommendationBadge } from "@/components/dashboard/recommendation-badge";
import { CS2_TYPE_OPTIONS } from "@/lib/constants";
import { isPositionHighRisk } from "@/lib/portfolio/metrics";
import {
  formatCs2TypeLabel,
  formatLiquidityLabel,
  formatPriceConfidenceLabel,
  formatPriceSourceLabel,
} from "@/lib/presentation";
import {
  cn,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRelativeTime,
} from "@/lib/utils";
import type { Cs2Position } from "@/types/portfolio";

type SortKey = "value" | "quantity" | "pnl" | "risk" | "name";
type SortDirection = "asc" | "desc";
type RiskFilter = "all" | "high-risk";
type QuickFilterId =
  | "missing-price"
  | "high-value"
  | "high-quantity"
  | "stale-price"
  | "negative-pnl"
  | "high-risk";

type QuickFilterDescriptor = {
  id: QuickFilterId;
  label: string;
  count: number;
  title: string;
  selectedClassName: string;
};

type QuickFilterThresholds = {
  highValue: number;
  highQuantity: number;
};

const liquidityTone: Record<Cs2Position["liquidityLabel"], string> = {
  High: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  Medium: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  Low: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  Unknown: "border-slate-400/30 bg-slate-400/10 text-slate-200",
};

function sortPositions(
  positions: Cs2Position[],
  sortKey: SortKey,
  sortDirection: SortDirection,
) {
  const direction = sortDirection === "asc" ? 1 : -1;

  return [...positions].sort((left, right) => {
    switch (sortKey) {
      case "name":
        return direction * left.name.localeCompare(right.name, "ru");
      case "quantity":
        return direction * (left.quantity - right.quantity);
      case "pnl":
        return direction * (left.pnl - right.pnl);
      case "risk":
        return direction * (left.riskScore - right.riskScore);
      case "value":
      default:
        return direction * (left.totalValue - right.totalValue);
    }
  });
}

function getPercentileThreshold(values: number[], percentile: number, fallback: number) {
  const positiveValues = values.filter((value) => value > 0).sort((left, right) => left - right);

  if (positiveValues.length === 0) {
    return fallback;
  }

  const index = Math.min(
    positiveValues.length - 1,
    Math.max(0, Math.floor((positiveValues.length - 1) * percentile)),
  );

  return Math.max(fallback, positiveValues[index] ?? fallback);
}

function isPriceStale(position: Cs2Position) {
  const warning = position.priceWarning?.toLowerCase() ?? "";
  if (warning.includes("stale") || warning.includes("устар")) {
    return true;
  }

  if (!position.priceLastUpdated) {
    return false;
  }

  const parsed = new Date(position.priceLastUpdated);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return Date.now() - parsed.getTime() > 1000 * 60 * 60 * 24 * 7;
}

function matchesQuickFilter(
  position: Cs2Position,
  filterId: QuickFilterId,
  thresholds: QuickFilterThresholds,
) {
  switch (filterId) {
    case "missing-price":
      return position.currentPrice === null || position.totalValue <= 0;
    case "high-value":
      return position.totalValue > 0 && position.totalValue >= thresholds.highValue;
    case "high-quantity":
      return position.quantity >= thresholds.highQuantity;
    case "stale-price":
      return isPriceStale(position);
    case "negative-pnl":
      return position.pnl < 0;
    case "high-risk":
      return isPositionHighRisk(position.riskScore, position.recommendation);
    default:
      return false;
  }
}

function EditButton({
  visible,
  onClick,
}: {
  visible?: boolean;
  onClick: () => void;
}) {
  if (!visible) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/16"
    >
      Редактировать
    </button>
  );
}

function formatPriceAge(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return formatRelativeTime(parsed);
}

export function Cs2Table({
  positions,
  currency,
  adminEnabled = false,
  onEditPosition,
}: {
  positions: Cs2Position[];
  currency: string;
  adminEnabled?: boolean;
  onEditPosition?: (position: Cs2Position) => void;
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<(typeof CS2_TYPE_OPTIONS)[number]["value"]>(
    "all",
  );
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [activeQuickFilters, setActiveQuickFilters] = useState<QuickFilterId[]>([]);

  const deferredQuery = useDeferredValue(query);
  const highRiskCount = positions.filter((position) =>
    isPositionHighRisk(position.riskScore, position.recommendation),
  ).length;

  const quickFilterThresholds = useMemo<QuickFilterThresholds>(
    () => ({
      highValue: getPercentileThreshold(
        positions.map((position) => position.totalValue),
        0.84,
        125,
      ),
      highQuantity: Math.max(
        5,
        Math.round(
          getPercentileThreshold(
            positions.map((position) => position.quantity),
            0.84,
            5,
          ),
        ),
      ),
    }),
    [positions],
  );

  const quickFilters = useMemo<QuickFilterDescriptor[]>(() => {
    const base = [
      {
        id: "missing-price" as const,
        label: "Нет цены",
        title: "Позиции без current price или с нулевой оценкой.",
        selectedClassName: "border-amber-300/30 bg-amber-300/12 text-amber-100",
      },
      {
        id: "high-value" as const,
        label: "Высокая стоимость",
        title: `Позиции от ${formatCurrency(quickFilterThresholds.highValue, currency, 0)} и выше.`,
        selectedClassName: "border-cyan-300/30 bg-cyan-300/12 text-cyan-100",
      },
      {
        id: "high-quantity" as const,
        label: "Много штук",
        title: `Позиции от ${formatNumber(quickFilterThresholds.highQuantity, 0)} шт. и выше.`,
        selectedClassName: "border-sky-300/30 bg-sky-300/12 text-sky-100",
      },
      {
        id: "stale-price" as const,
        label: "Устаревшая цена",
        title: "Позиции со stale warning или старым timestamp цены.",
        selectedClassName: "border-orange-300/30 bg-orange-300/12 text-orange-100",
      },
      {
        id: "negative-pnl" as const,
        label: "Отрицательный PnL",
        title: "Позиции с текущим отрицательным PnL.",
        selectedClassName: "border-rose-400/30 bg-rose-400/12 text-rose-100",
      },
      {
        id: "high-risk" as const,
        label: "High-risk",
        title: "Позиции, попавшие в high-risk layer по risk engine.",
        selectedClassName: "border-fuchsia-400/30 bg-fuchsia-400/12 text-fuchsia-100",
      },
    ];

    return base.map((filter) => ({
      ...filter,
      count: positions.filter((position) =>
        matchesQuickFilter(position, filter.id, quickFilterThresholds),
      ).length,
    }));
  }, [currency, positions, quickFilterThresholds]);

  const filteredPositions = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    const next = positions.filter((position) => {
      const matchesType = typeFilter === "all" || position.type === typeFilter;
      const matchesRisk =
        riskFilter === "all" || isPositionHighRisk(position.riskScore, position.recommendation);
      const matchesQuery =
        normalizedQuery.length === 0 || position.name.toLowerCase().includes(normalizedQuery);
      const matchesQuickFilters = activeQuickFilters.every((filterId) =>
        matchesQuickFilter(position, filterId, quickFilterThresholds),
      );

      return matchesType && matchesRisk && matchesQuery && matchesQuickFilters;
    });

    return sortPositions(next, sortKey, sortDirection);
  }, [
    activeQuickFilters,
    deferredQuery,
    positions,
    quickFilterThresholds,
    riskFilter,
    sortDirection,
    sortKey,
    typeFilter,
  ]);

  const pageSize = 30;
  const pageCount = Math.max(1, Math.ceil(filteredPositions.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visiblePositions = filteredPositions.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const visibleRangeStart = filteredPositions.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const visibleRangeEnd = Math.min(safePage * pageSize, filteredPositions.length);
  const hasActiveFilters =
    query.trim().length > 0 ||
    typeFilter !== "all" ||
    riskFilter !== "all" ||
    activeQuickFilters.length > 0;

  function toggleQuickFilter(filterId: QuickFilterId) {
    startTransition(() => setPage(1));
    setActiveQuickFilters((current) =>
      current.includes(filterId)
        ? current.filter((value) => value !== filterId)
        : [...current, filterId],
    );
  }

  function resetFilters() {
    setQuery("");
    setTypeFilter("all");
    setRiskFilter("all");
    setActiveQuickFilters([]);
    setSortKey("value");
    setSortDirection("desc");
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.4fr_0.82fr_0.82fr_0.82fr_0.72fr]">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.24em] text-slate-400">Поиск</label>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                startTransition(() => setPage(1));
              }}
              className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
              placeholder="AWP, capsule, holo..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Тип актива
            </label>
            <select
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value as (typeof CS2_TYPE_OPTIONS)[number]["value"]);
                startTransition(() => setPage(1));
              }}
              className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
            >
              {CS2_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-slate-950">
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Риск-фильтр
            </label>
            <select
              value={riskFilter}
              onChange={(event) => {
                setRiskFilter(event.target.value as RiskFilter);
                startTransition(() => setPage(1));
              }}
              className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
            >
              <option value="all" className="bg-slate-950">
                Все позиции
              </option>
              <option value="high-risk" className="bg-slate-950">
                Только high-risk
              </option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Сортировка
            </label>
            <select
              value={sortKey}
              onChange={(event) => {
                setSortKey(event.target.value as SortKey);
                startTransition(() => setPage(1));
              }}
              className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
            >
              <option value="value" className="bg-slate-950">
                По стоимости
              </option>
              <option value="quantity" className="bg-slate-950">
                По количеству
              </option>
              <option value="pnl" className="bg-slate-950">
                По PnL
              </option>
              <option value="risk" className="bg-slate-950">
                По риску
              </option>
              <option value="name" className="bg-slate-950">
                По названию
              </option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Порядок
            </label>
            <button
              type="button"
              onClick={() => {
                setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
                startTransition(() => setPage(1));
              }}
              className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/8"
            >
              {sortDirection === "desc" ? "По убыванию" : "По возрастанию"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-sm text-slate-300">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
            {filteredPositions.length.toLocaleString("ru-RU")} совпадений
          </span>
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-cyan-100">
            Показано {visibleRangeStart}-{visibleRangeEnd}
          </span>
          <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-amber-100">
            {highRiskCount.toLocaleString("ru-RU")} high-risk
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
            Страница {safePage}/{pageCount}
          </span>
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(8,18,35,0.62),rgba(9,24,42,0.5))] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Быстрые фильтры</p>
            <p className="mt-2 text-sm leading-6 text-slate-300/76">
              Быстрый фокус на missing price, stale quotes, high-value и проблемных позициях без перегруза таблицы даже на больших inventory snapshot.
            </p>
          </div>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/8"
            >
              Сбросить все фильтры
            </button>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2.5">
          {quickFilters.map((filter) => {
            const isActive = activeQuickFilters.includes(filter.id);

            return (
              <button
                key={filter.id}
                type="button"
                title={filter.title}
                onClick={() => toggleQuickFilter(filter.id)}
                className={cn(
                  "rounded-full border px-3.5 py-2 text-sm transition",
                  isActive
                    ? filter.selectedClassName
                    : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/8",
                )}
              >
                <span>{filter.label}</span>
                <span className="ml-2 rounded-full bg-black/15 px-2 py-0.5 text-xs text-current/90">
                  {filter.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 lg:hidden">
        {visiblePositions.length === 0 ? (
          <DashboardStatePanel
            eyebrow="CS2 registry"
            title="Позиции не найдены"
            description={
              hasActiveFilters
                ? "Сними часть фильтров или расширь поисковый запрос, чтобы вернуть скрытые позиции обратно в список."
                : "После следующего синка или появления оцененных позиций карточки автоматически заполнятся."
            }
            className="min-h-[240px]"
          />
        ) : (
          visiblePositions.map((position) => (
            <article
              key={position.id}
              className="rounded-3xl border border-white/10 bg-slate-950/35 px-4 py-4 text-sm text-slate-200"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-white">{position.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-200/55">
                    {formatPriceSourceLabel(position.priceSource)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs ${liquidityTone[position.liquidityLabel]}`}
                  >
                    {formatLiquidityLabel(position.liquidityLabel)}
                  </span>
                  <RecommendationBadge recommendation={position.recommendation} />
                </div>
              </div>

              {position.priceWarning ? (
                <p className="mt-3 rounded-2xl border border-amber-300/15 bg-amber-300/8 px-3 py-3 text-xs leading-5 text-amber-200/90">
                  {position.priceWarning}
                </p>
              ) : null}

              <p className="mt-3 text-sm leading-6 text-slate-300/82">{position.riskSummary}</p>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Тип</p>
                  <p className="mt-2 text-white">{formatCs2TypeLabel(position.type)}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Кол-во</p>
                  <p className="mt-2 text-white">{formatNumber(position.quantity, 0)}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Текущая цена</p>
                  <p className="mt-2 text-white">
                    {position.currentPrice !== null
                      ? formatCurrency(position.currentPrice, currency, 2)
                      : "—"}
                  </p>
                  {formatPriceAge(position.priceLastUpdated) ? (
                    <p className="mt-2 text-xs text-slate-400">{formatPriceAge(position.priceLastUpdated)}</p>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Стоимость</p>
                  <p className="mt-2 text-white">{formatCurrency(position.totalValue, currency, 2)}</p>
                  <p className="mt-2 text-xs text-slate-400">{formatPercent(position.portfolioWeight)}</p>
                </div>
              </div>

              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">PnL</p>
                  <p className={position.pnl >= 0 ? "mt-2 text-emerald-300" : "mt-2 text-rose-300"}>
                    {formatCurrency(position.pnl, currency, 2)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{formatPercent(position.pnlPercent)}</p>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <p>Риск {position.riskScore}</p>
                  <p className="mt-1">{formatPriceConfidenceLabel(position.priceConfidence)} confidence</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/8 pt-4">
                <div className="text-xs text-slate-400">
                  <p>Статус: {position.status ?? "—"}</p>
                  <p className="mt-1">Обновлено: {position.lastUpdated ?? "—"}</p>
                </div>
                <EditButton
                  visible={adminEnabled && Boolean(onEditPosition)}
                  onClick={() => onEditPosition?.(position)}
                />
              </div>
            </article>
          ))
        )}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-white/10 bg-slate-950/35 lg:block">
        <div className="max-h-[720px] overflow-auto">
          <div className="min-w-[1160px]">
            <div className="sticky top-0 z-20 grid grid-cols-[1.95fr_0.7fr_0.8fr_1.05fr_0.9fr_1fr_0.95fr_1.15fr_0.9fr] gap-3 border-b border-white/10 bg-slate-950/95 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-400 backdrop-blur-xl">
              <span>Позиция</span>
              <span>Тип</span>
              <span>Кол-во</span>
              <span>Цена</span>
              <span>Стоимость</span>
              <span>PnL</span>
              <span>Ликвидность</span>
              <span>Сигнал</span>
              <span>Действие</span>
            </div>
            {visiblePositions.length === 0 ? (
              <div className="p-4">
                <DashboardStatePanel
                  eyebrow="CS2 registry"
                  title="По текущим фильтрам позиции не найдены"
                  description={
                    hasActiveFilters
                      ? "Очисти часть фильтров или измени сортировку, чтобы вернуть позиции в desktop-таблицу."
                      : "После следующего live sync здесь появятся CS2 позиции с текущими ценами и risk cues."
                  }
                  className="min-h-[240px]"
                />
              </div>
            ) : (
              visiblePositions.map((position) => (
                <div
                  key={position.id}
                  className="grid grid-cols-[1.95fr_0.7fr_0.8fr_1.05fr_0.9fr_1fr_0.95fr_1.15fr_0.9fr] gap-3 border-b border-white/6 px-4 py-4 text-sm text-slate-200 last:border-b-0"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-white">{position.name}</p>
                      <RecommendationBadge recommendation={position.recommendation} />
                    </div>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-200/55">
                      {formatPriceSourceLabel(position.priceSource)}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-400">{position.riskSummary}</p>
                    {position.priceWarning ? (
                      <p className="mt-2 text-xs text-amber-200/90">{position.priceWarning}</p>
                    ) : null}
                  </div>
                  <span className="text-slate-300">{formatCs2TypeLabel(position.type)}</span>
                  <span>{formatNumber(position.quantity, 0)}</span>
                  <div>
                    <p className="text-white">
                      {position.currentPrice !== null
                        ? formatCurrency(position.currentPrice, currency, 2)
                        : "—"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatPriceConfidenceLabel(position.priceConfidence)} confidence
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatPriceAge(position.priceLastUpdated) ?? "Нет timestamp"}
                    </p>
                  </div>
                  <div>
                    <p className="text-white">{formatCurrency(position.totalValue, currency, 2)}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatPercent(position.portfolioWeight)}</p>
                  </div>
                  <span className={position.pnl >= 0 ? "text-emerald-300" : "text-rose-300"}>
                    <span>{formatCurrency(position.pnl, currency, 2)}</span>
                    <span className="mt-1 block text-xs opacity-80">
                      {formatPercent(position.pnlPercent)}
                    </span>
                  </span>
                  <span>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${liquidityTone[position.liquidityLabel]}`}
                    >
                      {formatLiquidityLabel(position.liquidityLabel)}
                    </span>
                    <span className="mt-2 block text-xs text-slate-400">Риск {position.riskScore}</span>
                  </span>
                  <div>
                    <p className="text-white">{position.market ?? "Sheet / fallback"}</p>
                    <p className="mt-1 text-xs text-slate-400">Статус: {position.status ?? "—"}</p>
                  </div>
                  <div className="flex justify-end">
                    <EditButton
                      visible={adminEnabled && Boolean(onEditPosition)}
                      onClick={() => onEditPosition?.(position)}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setPage((current) => Math.max(current - 1, 1))}
          disabled={safePage <= 1}
          className="rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Назад
        </button>
        <span className="text-sm text-slate-400">
          Страница {safePage}/{pageCount} · {pageSize} строк на экран
        </span>
        <button
          type="button"
          onClick={() => setPage((current) => Math.min(current + 1, pageCount))}
          disabled={safePage >= pageCount}
          className="rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Дальше
        </button>
      </div>
    </div>
  );
}
