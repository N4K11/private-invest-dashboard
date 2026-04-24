"use client";

import { startTransition, useDeferredValue, useMemo, useState } from "react";

import { TRANSACTION_ACTION_OPTIONS } from "@/lib/constants";
import {
  formatAssetCategoryLabel,
  formatTransactionActionLabel,
} from "@/lib/presentation";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { AssetCategory, TransactionAction, TransactionRecord } from "@/types/portfolio";

type TransactionHistoryTableProps = {
  transactions: TransactionRecord[];
  currency: string;
  adminEnabled?: boolean;
  onAddTransaction?: () => void;
};

function toDateInputValue(value: string | null) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString().slice(0, 10);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function matchesDateRange(value: string | null, dateFrom: string, dateTo: string) {
  if (!dateFrom && !dateTo) {
    return true;
  }

  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return false;
  }

  if (dateFrom) {
    const from = new Date(`${dateFrom}T00:00:00`);
    if (parsed < from) {
      return false;
    }
  }

  if (dateTo) {
    const to = new Date(`${dateTo}T23:59:59.999`);
    if (parsed > to) {
      return false;
    }
  }

  return true;
}

export function TransactionHistoryTable({
  transactions,
  currency,
  adminEnabled = false,
  onAddTransaction,
}: TransactionHistoryTableProps) {
  const [query, setQuery] = useState("");
  const [assetType, setAssetType] = useState<AssetCategory | "all">("all");
  const [action, setAction] = useState<TransactionAction | "all">("all");
  const [dateFrom, setDateFrom] = useState(() => toDateInputValue(transactions[transactions.length - 1]?.date ?? null));
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const deferredQuery = useDeferredValue(query);

  const filteredTransactions = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const matchesName =
        normalizedQuery.length === 0 ||
        (transaction.assetName ?? "").toLowerCase().includes(normalizedQuery);
      const matchesCategory = assetType === "all" || transaction.assetType === assetType;
      const matchesAction = action === "all" || transaction.action === action;
      const matchesDate = matchesDateRange(transaction.date, dateFrom, dateTo);

      return matchesName && matchesCategory && matchesAction && matchesDate;
    });
  }, [action, assetType, dateFrom, dateTo, deferredQuery, transactions]);

  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visibleTransactions = filteredTransactions.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.5fr_0.8fr_0.9fr_0.8fr_0.8fr]">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.24em] text-slate-400">Поиск</span>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                startTransition(() => setPage(1));
              }}
              placeholder="Bitcoin, Dragon Lore, Founder Chest..."
              className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.24em] text-slate-400">Категория</span>
            <select
              value={assetType}
              onChange={(event) => {
                setAssetType(event.target.value as AssetCategory | "all");
                startTransition(() => setPage(1));
              }}
              className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
            >
              <option value="all" className="bg-slate-950">Все категории</option>
              <option value="cs2" className="bg-slate-950">CS2</option>
              <option value="telegram" className="bg-slate-950">Подарки Telegram</option>
              <option value="crypto" className="bg-slate-950">Крипта</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.24em] text-slate-400">Действие</span>
            <select
              value={action}
              onChange={(event) => {
                setAction(event.target.value as TransactionAction | "all");
                startTransition(() => setPage(1));
              }}
              className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
            >
              {TRANSACTION_ACTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-slate-950">
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.24em] text-slate-400">Дата от</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                startTransition(() => setPage(1));
              }}
              className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.24em] text-slate-400">Дата до</span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                startTransition(() => setPage(1));
              }}
              className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
            {filteredTransactions.length.toLocaleString("ru-RU")} транзакций
          </span>
          {adminEnabled && onAddTransaction ? (
            <button
              type="button"
              onClick={onAddTransaction}
              className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/16"
            >
              + Добавить транзакцию
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 lg:hidden">
        {visibleTransactions.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-slate-950/35 px-4 py-8 text-sm text-slate-400">
            По текущим фильтрам транзакции не найдены.
          </div>
        ) : (
          visibleTransactions.map((transaction) => (
            <article
              key={transaction.id}
              className="rounded-3xl border border-white/10 bg-slate-950/35 px-4 py-4 text-sm text-slate-200"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-white">{transaction.assetName ?? "Без названия"}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-200/55">
                    {formatTransactionActionLabel(transaction.action)}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <p>{formatAssetCategoryLabel(transaction.assetType)}</p>
                  <p className="mt-1">{formatDateTime(transaction.date)}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Количество</p>
                  <p className="mt-2 text-white">
                    {transaction.quantity !== null ? formatNumber(transaction.quantity, 6) : "—"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Цена</p>
                  <p className="mt-2 text-white">
                    {transaction.price !== null ? formatCurrency(transaction.price, currency, 2) : "—"}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/8 pt-4 text-xs text-slate-400">
                <div>
                  <p>Fees: {formatCurrency(transaction.fees, currency, 2)}</p>
                  <p className="mt-1">Валюта: {transaction.currency ?? currency}</p>
                </div>
                <p className="max-w-[55%] text-right">{transaction.notes ?? "Без заметок"}</p>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-white/10 bg-slate-950/35 lg:block">
        <div className="grid grid-cols-[1fr_0.8fr_1.4fr_0.85fr_0.85fr_0.8fr_0.8fr_1.25fr] gap-3 border-b border-white/10 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">
          <span>Дата</span>
          <span>Категория</span>
          <span>Актив</span>
          <span>Действие</span>
          <span>Кол-во</span>
          <span>Цена</span>
          <span>Fees</span>
          <span>Заметки</span>
        </div>
        <div className="max-h-[560px] overflow-y-auto">
          {visibleTransactions.length === 0 ? (
            <div className="px-4 py-10 text-sm text-slate-400">
              По текущим фильтрам транзакции не найдены.
            </div>
          ) : (
            visibleTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="grid grid-cols-[1fr_0.8fr_1.4fr_0.85fr_0.85fr_0.8fr_0.8fr_1.25fr] gap-3 border-b border-white/6 px-4 py-4 text-sm text-slate-200 last:border-b-0"
              >
                <span className="text-slate-300">{formatDateTime(transaction.date)}</span>
                <span>{formatAssetCategoryLabel(transaction.assetType)}</span>
                <span className="font-medium text-white">{transaction.assetName ?? "—"}</span>
                <span>{formatTransactionActionLabel(transaction.action)}</span>
                <span>{transaction.quantity !== null ? formatNumber(transaction.quantity, 6) : "—"}</span>
                <span>{transaction.price !== null ? formatCurrency(transaction.price, currency, 2) : "—"}</span>
                <span>{formatCurrency(transaction.fees, currency, 2)}</span>
                <span className="text-slate-400">{transaction.notes ?? "—"}</span>
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
        <span className="text-sm text-slate-400">
          Страница {safePage}/{pageCount}
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
