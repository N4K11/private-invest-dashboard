"use client";

import { startTransition, useDeferredValue, useMemo, useState } from "react";

import { CS2_TYPE_OPTIONS } from "@/lib/constants";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
} from "@/lib/utils";
import type { Cs2Position } from "@/types/portfolio";

type SortKey = "value" | "quantity" | "pnl" | "risk" | "name";
type SortDirection = "asc" | "desc";

type Cs2TableProps = {
  positions: Cs2Position[];
  currency: string;
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
        return direction * left.name.localeCompare(right.name);
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

export function Cs2Table({ positions, currency }: Cs2TableProps) {
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
        normalizedQuery.length === 0 ||
        position.name.toLowerCase().includes(normalizedQuery);

      return matchesType && matchesQuery;
    });

    return sortPositions(next, sortKey, sortDirection);
  }, [deferredQuery, positions, sortDirection, sortKey, typeFilter]);

  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(filteredPositions.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visiblePositions = filteredPositions.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.4fr_0.8fr_0.8fr_0.7fr]">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Search position
            </label>
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
              Asset type
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
              Sort by
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
                Value
              </option>
              <option value="quantity" className="bg-slate-950">
                Quantity
              </option>
              <option value="pnl" className="bg-slate-950">
                PnL
              </option>
              <option value="risk" className="bg-slate-950">
                Risk
              </option>
              <option value="name" className="bg-slate-950">
                Name
              </option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Direction
            </label>
            <button
              type="button"
              onClick={() => {
                setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
                startTransition(() => setPage(1));
              }}
              className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/8"
            >
              {sortDirection === "desc" ? "Descending" : "Ascending"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-sm text-slate-300">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            {filteredPositions.length.toLocaleString("en-US")} matches
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            Page {safePage}/{pageCount}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/35">
        <div className="grid grid-cols-[1.7fr_0.75fr_0.9fr_0.9fr_1fr_1fr_0.85fr_0.8fr] gap-3 border-b border-white/10 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">
          <span>Position</span>
          <span>Type</span>
          <span>Qty</span>
          <span>Entry</span>
          <span>Current</span>
          <span>Value</span>
          <span>PnL</span>
          <span>Liquidity</span>
        </div>
        <div className="max-h-[720px] overflow-y-auto">
          {visiblePositions.length === 0 ? (
            <div className="px-4 py-10 text-sm text-slate-400">
              No positions match the current filters.
            </div>
          ) : (
            visiblePositions.map((position) => (
              <div
                key={position.id}
                className="grid grid-cols-[1.7fr_0.75fr_0.9fr_0.9fr_1fr_1fr_0.85fr_0.8fr] gap-3 border-b border-white/6 px-4 py-4 text-sm text-slate-200 last:border-b-0"
              >
                <div>
                  <p className="font-medium text-white">{position.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-200/55">
                    {position.priceSource}
                  </p>
                </div>
                <span className="capitalize text-slate-300">{position.type}</span>
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
                <span>{formatCurrency(position.totalValue, currency)}</span>
                <span
                  className={
                    position.pnl >= 0 ? "text-emerald-300" : "text-rose-300"
                  }
                >
                  <span>{formatCurrency(position.pnl, currency)}</span>
                  <span className="block text-xs opacity-80">
                    {formatPercent(position.pnlPercent)}
                  </span>
                </span>
                <span>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${liquidityTone[position.liquidityLabel]}`}
                  >
                    {position.liquidityLabel}
                  </span>
                  <span className="mt-2 block text-xs text-slate-400">
                    Risk {position.riskScore}
                  </span>
                </span>
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
          Previous
        </button>
        <button
          type="button"
          onClick={() => setPage((current) => Math.min(current + 1, pageCount))}
          disabled={safePage >= pageCount}
          className="rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
