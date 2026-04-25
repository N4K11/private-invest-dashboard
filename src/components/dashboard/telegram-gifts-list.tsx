"use client";

import type { ReactNode } from "react";

import {
  formatPriceConfidenceLabel,
  formatPriceSourceLabel,
  formatTransactionActionLabel,
} from "@/lib/presentation";
import { formatCurrency, formatNumber, formatRelativeTime } from "@/lib/utils";
import type { TelegramGiftAnalytics, TelegramGiftPosition } from "@/types/portfolio";

type TelegramGiftsListProps = {
  positions: TelegramGiftPosition[];
  analytics: TelegramGiftAnalytics;
  currency: string;
  adminEnabled?: boolean;
  onEditPosition?: (position: TelegramGiftPosition) => void;
  onQuickPriceUpdate?: (position: TelegramGiftPosition) => void;
};

function ActionButton({
  label,
  visible,
  tone = "neutral",
  onClick,
}: {
  label: string;
  visible?: boolean;
  tone?: "neutral" | "accent";
  onClick: () => void;
}) {
  if (!visible) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={tone === "accent" ? "rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/16" : "rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/8"}
    >
      {label}
    </button>
  );
}

function formatCheckedAt(value: string | null) {
  if (!value) {
    return "Без даты проверки";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return formatRelativeTime(parsed);
}

function AnalyticsCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-400">{hint}</p>
    </div>
  );
}

function SmallList({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: ReactNode[];
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
      <div className="mt-4 space-y-3">{items.length > 0 ? items : <p className="text-sm text-slate-500">Пока пусто.</p>}</div>
    </div>
  );
}

export function TelegramGiftsList({
  positions,
  analytics,
  currency,
  adminEnabled = false,
  onEditPosition,
  onQuickPriceUpdate,
}: TelegramGiftsListProps) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AnalyticsCard
          label="Стоимость подарков"
          value={formatCurrency(analytics.totalValue, currency, 2)}
          hint="Суммарная оценка блока Telegram Gifts."
        />
        <AnalyticsCard
          label="Всего предметов"
          value={formatNumber(analytics.totalItems, 0)}
          hint={`${positions.length.toLocaleString("ru-RU")} позиций в этом сегменте.`}
        />
        <AnalyticsCard
          label="Низкая уверенность"
          value={formatNumber(analytics.lowConfidencePricing.length, 0)}
          hint="Подарки без уверенной оценки или с low confidence."
        />
        <AnalyticsCard
          label="Устаревшие цены"
          value={formatNumber(analytics.stalePriceList.length, 0)}
          hint="Позиции, которым нужен новый price check."
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SmallList
          title="Value by collection"
          description="Какие коллекции держат основную стоимость Telegram Gifts."
          items={analytics.valueByCollection.map((item) => (
            <div key={item.collection} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-slate-950/25 px-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-white">{item.collection}</p>
                <p className="mt-1 text-xs text-slate-400">{item.positions} поз. · {formatNumber(item.quantity, 0)} шт.</p>
              </div>
              <p className="shrink-0 font-medium text-white">{formatCurrency(item.value, currency, 2)}</p>
            </div>
          ))}
        />
        <SmallList
          title="Top gifts by value"
          description="Крупнейшие Telegram-позиции по текущей стоимости."
          items={analytics.topGiftsByValue.map((position) => (
            <div key={position.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-slate-950/25 px-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-white">{position.name}</p>
                <p className="mt-1 text-xs text-slate-400">{position.collection ?? "Без коллекции"}</p>
              </div>
              <p className="shrink-0 font-medium text-white">{formatCurrency(position.totalValue, currency, 2)}</p>
            </div>
          ))}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SmallList
          title="Low confidence"
          description="Подарки, по которым лучше перепроверить цену вручную."
          items={analytics.lowConfidencePricing.map((position) => (
            <div key={position.id} className="rounded-2xl border border-amber-300/15 bg-amber-300/8 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{position.name}</p>
                  <p className="mt-1 text-xs text-amber-100/80">{position.priceConfidence ? formatPriceConfidenceLabel(position.priceConfidence) : "Confidence не задан"}</p>
                </div>
                <p className="shrink-0 font-medium text-white">{formatCurrency(position.totalValue, currency, 2)}</p>
              </div>
              {position.priceWarning ? <p className="mt-2 text-xs leading-5 text-amber-100/90">{position.priceWarning}</p> : null}
            </div>
          ))}
        />
        <SmallList
          title="Stale pricing"
          description="Позиции, которым нужен новый manual price check."
          items={analytics.stalePriceList.map((position) => (
            <div key={position.id} className="rounded-2xl border border-rose-400/15 bg-rose-400/8 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{position.name}</p>
                  <p className="mt-1 text-xs text-rose-100/80">Проверено {formatCheckedAt(position.priceLastCheckedAt)}</p>
                </div>
                <p className="shrink-0 font-medium text-white">{formatCurrency(position.totalValue, currency, 2)}</p>
              </div>
              {position.priceSourceNote ? <p className="mt-2 text-xs leading-5 text-rose-50/85">{position.priceSourceNote}</p> : null}
            </div>
          ))}
        />
        <SmallList
          title="Price updates"
          description="Последние изменения цены через Transactions / price_update."
          items={analytics.recentPriceUpdates.map((transaction) => (
            <div key={transaction.id} className="rounded-2xl border border-white/8 bg-slate-950/25 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{transaction.assetName ?? "Без названия"}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatTransactionActionLabel(transaction.action)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-medium text-white">{transaction.price !== null ? formatCurrency(transaction.price, currency, 2) : "—"}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatCheckedAt(transaction.date)}</p>
                </div>
              </div>
            </div>
          ))}
        />
      </div>

      <div className="space-y-3 lg:hidden">
        {positions.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-slate-950/30 px-4 py-8 text-sm text-slate-400">
            В подключенной таблице пока нет подарков Telegram.
          </div>
        ) : (
          positions.map((position) => (
            <article
              key={position.id}
              className="rounded-3xl border border-white/10 bg-slate-950/30 px-4 py-4 text-sm text-slate-200"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-white">{position.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-200/55">
                    {formatPriceSourceLabel(position.priceSource)}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    {position.priceConfidence ? formatPriceConfidenceLabel(position.priceConfidence) : "Confidence не задан"} · проверено {formatCheckedAt(position.priceLastCheckedAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-white">{formatCurrency(position.totalValue, currency, 2)}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatNumber(position.quantity, 0)} шт.</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Цена за единицу</p>
                  <p className="mt-2 text-white">
                    {position.estimatedPrice !== null
                      ? formatCurrency(position.estimatedPrice, currency, 2)
                      : "—"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Коллекция</p>
                  <p className="mt-2 text-white">{position.collection ?? "—"}</p>
                </div>
              </div>
              {position.priceWarning ? (
                <p className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/8 px-3 py-3 text-xs leading-5 text-amber-100/90">
                  {position.priceWarning}
                </p>
              ) : null}
              {position.priceSourceNote ? (
                <p className="mt-3 text-xs leading-5 text-slate-400">{position.priceSourceNote}</p>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4">
                <div className="text-xs text-slate-400">
                  <p>Статус: {position.status ?? "—"}</p>
                  <p className="mt-1">P&L: {formatCurrency(position.pnl, currency, 2)}</p>
                </div>
                <div className="flex gap-2">
                  <ActionButton
                    label="Price update"
                    tone="accent"
                    visible={adminEnabled && Boolean(onQuickPriceUpdate)}
                    onClick={() => onQuickPriceUpdate?.(position)}
                  />
                  <ActionButton
                    label="Редактировать"
                    visible={adminEnabled && Boolean(onEditPosition)}
                    onClick={() => onEditPosition?.(position)}
                  />
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-white/10 bg-slate-950/30 lg:block">
        <div className="grid grid-cols-[1.35fr_0.7fr_0.9fr_1fr_1.15fr_0.95fr] gap-3 border-b border-white/10 px-4 py-3 text-xs uppercase tracking-[0.22em] text-slate-400">
          <span>Название</span>
          <span>Кол-во</span>
          <span>Цена</span>
          <span>Цена и check</span>
          <span>Source note</span>
          <span>Действие</span>
        </div>
        <div className="max-h-[520px] overflow-y-auto">
          {positions.length === 0 ? (
            <div className="px-4 py-8 text-sm text-slate-400">
              В подключенной таблице пока нет подарков Telegram.
            </div>
          ) : (
            positions.map((position) => (
              <div
                key={position.id}
                className="grid grid-cols-[1.35fr_0.7fr_0.9fr_1fr_1.15fr_0.95fr] gap-3 border-b border-white/6 px-4 py-4 text-sm text-slate-200 last:border-b-0"
              >
                <div>
                  <p className="font-medium text-white">{position.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-200/55">
                    {formatPriceSourceLabel(position.priceSource)}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">{position.collection ?? "Без коллекции"}</p>
                  {position.priceWarning ? (
                    <p className="mt-2 text-xs leading-5 text-amber-200/90">{position.priceWarning}</p>
                  ) : null}
                </div>
                <span>{formatNumber(position.quantity, 0)}</span>
                <span>
                  {position.estimatedPrice !== null
                    ? formatCurrency(position.estimatedPrice, currency, 2)
                    : "—"}
                </span>
                <div>
                  <p className="text-white">
                    {position.priceConfidence ? formatPriceConfidenceLabel(position.priceConfidence) : "Confidence не задан"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Проверено {formatCheckedAt(position.priceLastCheckedAt)}</p>
                  <p className={position.isPriceStale ? "mt-2 text-xs text-rose-200/85" : "mt-2 text-xs text-emerald-200/80"}>
                    {position.isPriceStale ? "Нужен новый price check" : "Цена свежая"}
                  </p>
                </div>
                <div className="text-slate-400">
                  <p>{position.priceSourceNote ?? "—"}</p>
                  <p className="mt-2 text-xs text-slate-500">{position.notes ?? ""}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <ActionButton
                    label="Price update"
                    tone="accent"
                    visible={adminEnabled && Boolean(onQuickPriceUpdate)}
                    onClick={() => onQuickPriceUpdate?.(position)}
                  />
                  <ActionButton
                    label="Редактировать"
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
  );
}



