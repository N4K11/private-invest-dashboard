"use client";

import { startTransition, useDeferredValue, useMemo, useState } from "react";

import { CS2_TYPE_OPTIONS } from "@/lib/constants";
import {
  formatCs2TypeLabel,
  formatLiquidityLabel,
  formatPriceSourceLabel,
} from "@/lib/presentation";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import type { Cs2Position } from "@/types/portfolio";

type SortKey = "value" | "quantity" | "pnl" | "risk" | "name";
type SortDirection = "asc" | "desc";

type Cs2TableProps = {
  positions: Cs2Position[];
  currency: string;
  adminEnabled?: boolean;
  onEditPosition?: (position: Cs2Position) => void;
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

export function Cs2Table({
  positions,
  currency,
  adminEnabled = false,
  onEditPosition,
}: Cs2TableProps) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<(typeof CS2_TYPE_OPTIONS)[number]["value"]>(
    "all",
  );
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);

  const deferredQuery = useDeferredValue(query);

  const filteredPositions = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    const next = positions.filter((position) => {
      const matchesType = typeFilter === "all" || position.type === typeFilter;
      const matchesQuery =
        normalizedQuery.length === 0 || position.name.toLowerCase().includes(normalizedQuery);

      return matchesType && matchesQuery;
    });

    return sortPositions(next, sortKey, sortDirection);
  }, [deferredQuery, positions, sortDirection, sortKey, typeFilter]);

  const pageSize = 30;
  const pageCount = Math.max(1, Math.ceil(filteredPositions.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visiblePositions = filteredPositions.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.5fr_0.85fr_0.85fr_0.72fr]">
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
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
            Страница {safePage}/{pageCount}
          </span>
        </div>
      </div>

      <div className="space-y-3 lg:hidden">
        {visiblePositions.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-slate-950/35 px-4 py-8 text-sm text-slate-400">
            По текущим фильтрам позиции не найдены.
          </div>
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
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${liquidityTone[position.liquidityLabel]}`}
                >
                  {formatLiquidityLabel(position.liquidityLabel)}
                </span>
              </div>

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
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Стоимость</p>
                  <p className="mt-2 text-white">{formatCurrency(position.totalValue, currency, 2)}</p>
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
                  <p className="mt-1">{position.market ?? "Источник: таблица"}</p>
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
        <div className="grid grid-cols-[1.7fr_0.75fr_0.9fr_0.9fr_1fr_1fr_0.95fr_0.9fr_0.9fr] gap-3 border-b border-white/10 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">
          <span>Позиция</span>
          <span>Тип</span>
          <span>Кол-во</span>
          <span>Вход</span>
          <span>Текущая</span>
          <span>Стоимость</span>
          <span>PnL</span>
          <span>Ликвидность</span>
          <span>Действие</span>
        </div>
        <div className="max-h-[720px] overflow-y-auto">
          {visiblePositions.length === 0 ? (
            <div className="px-4 py-10 text-sm text-slate-400">
              По текущим фильтрам позиции не найдены.
            </div>
          ) : (
            visiblePositions.map((position) => (
              <div
                key={position.id}
                className="grid grid-cols-[1.7fr_0.75fr_0.9fr_0.9fr_1fr_1fr_0.95fr_0.9fr_0.9fr] gap-3 border-b border-white/6 px-4 py-4 text-sm text-slate-200 last:border-b-0"
              >
                <div>
                  <p className="font-medium text-white">{position.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-200/55">
                    {formatPriceSourceLabel(position.priceSource)}
                  </p>
                </div>
                <span className="text-slate-300">{formatCs2TypeLabel(position.type)}</span>
                <span>{formatNumber(position.quantity, 0)}</span>
                <span>
                  {position.averageEntryPrice !== null
                    ? formatCurrency(position.averageEntryPrice, currency, 2)
                    : "—"}
                </span>
                <span>
                  {position.currentPrice !== null
                    ? formatCurrency(position.currentPrice, currency, 2)
                    : "—"}
                </span>
                <span>{formatCurrency(position.totalValue, currency, 2)}</span>
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

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setPage((current) => Math.max(current - 1, 1))}
          disabled={safePage <= 1}
          className="rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Назад
        </button>
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
