"use client";

import { RecommendationBadge } from "@/components/dashboard/recommendation-badge";
import { isPositionHighRisk } from "@/lib/portfolio/metrics";
import { formatPriceSourceLabel } from "@/lib/presentation";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import type { CryptoPosition } from "@/types/portfolio";

type CryptoPanelProps = {
  positions: CryptoPosition[];
  currency: string;
  adminEnabled?: boolean;
  onEditPosition?: (position: CryptoPosition) => void;
};

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

export function CryptoPanel({
  positions,
  currency,
  adminEnabled = false,
  onEditPosition,
}: CryptoPanelProps) {
  const liveCount = positions.filter((position) => position.isLivePrice).length;
  const highRiskCount = positions.filter((position) =>
    isPositionHighRisk(position.riskScore, position.recommendation),
  ).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
        <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-emerald-200">
          {liveCount}/{positions.length} live-котировок
        </span>
        <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-amber-100">
          {highRiskCount} high-risk
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
          Основной источник: CoinGecko
        </span>
      </div>

      <div className="space-y-3 lg:hidden">
        {positions.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-slate-950/30 px-4 py-8 text-sm text-slate-400">
            В подключенной таблице пока нет крипто-позиций.
          </div>
        ) : (
          positions.map((position) => (
            <article
              key={position.id}
              className="rounded-3xl border border-white/10 bg-slate-950/30 px-4 py-4 text-sm text-slate-200"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">{position.symbol}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-200/55">
                    {formatPriceSourceLabel(position.priceSource)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 text-right">
                  <RecommendationBadge recommendation={position.recommendation} />
                  <p className="text-xs text-slate-400">Риск {position.riskScore}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Стоимость</p>
                  <p className="mt-2 text-white">{formatCurrency(position.totalValue, currency, 2)}</p>
                  <p className="mt-2 text-xs text-slate-400">{position.name}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Вес в портфеле</p>
                  <p className="mt-2 text-white">{formatPercent(position.portfolioWeight)}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Количество</p>
                  <p className="mt-2 text-white">{formatNumber(position.quantity, 6)}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Текущая цена</p>
                  <p className="mt-2 text-white">
                    {position.currentPrice !== null
                      ? formatCurrency(position.currentPrice, currency, 2)
                      : "—"}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-300/82">{position.riskSummary}</p>

              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Цена входа</p>
                  <p className="mt-2 text-white">
                    {position.averageEntryPrice !== null
                      ? formatCurrency(position.averageEntryPrice, currency, 2)
                      : "—"}
                  </p>
                </div>
                <div className={position.pnl >= 0 ? "text-right text-emerald-300" : "text-right text-rose-300"}>
                  <p>{formatCurrency(position.pnl, currency, 2)}</p>
                  <p className="mt-1 text-xs opacity-80">{formatPercent(position.pnlPercent)}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/8 pt-4">
                <div className="text-xs text-slate-400">
                  <p>Статус: {position.status ?? "—"}</p>
                  <p className="mt-1">Кошелек: {position.walletNote ?? "—"}</p>
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

      <div className="hidden overflow-hidden rounded-2xl border border-white/10 bg-slate-950/30 lg:block">
        <div className="grid grid-cols-[0.72fr_1.25fr_0.82fr_0.88fr_0.9fr_0.95fr_1.2fr_0.9fr] gap-3 border-b border-white/10 px-4 py-3 text-xs uppercase tracking-[0.22em] text-slate-400">
          <span>Тикер</span>
          <span>Актив</span>
          <span>Кол-во</span>
          <span>Вход</span>
          <span>Текущая</span>
          <span>Стоимость</span>
          <span>Риск</span>
          <span>Действие</span>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {positions.length === 0 ? (
            <div className="px-4 py-8 text-sm text-slate-400">
              В подключенной таблице пока нет крипто-позиций.
            </div>
          ) : (
            positions.map((position) => (
              <div
                key={position.id}
                className="grid grid-cols-[0.72fr_1.25fr_0.82fr_0.88fr_0.9fr_0.95fr_1.2fr_0.9fr] gap-3 border-b border-white/6 px-4 py-4 text-sm text-slate-200 last:border-b-0"
              >
                <span className="font-medium text-white">{position.symbol}</span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-white">{position.name}</p>
                    <RecommendationBadge recommendation={position.recommendation} />
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-200/55">
                    {formatPriceSourceLabel(position.priceSource)}
                  </p>
                </div>
                <span>{formatNumber(position.quantity, 4)}</span>
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
                <div>
                  <p>{formatCurrency(position.totalValue, currency, 2)}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatPercent(position.portfolioWeight)}</p>
                </div>
                <div>
                  <p className="text-white">Риск {position.riskScore}</p>
                  <p className="mt-1 text-xs text-slate-400">{position.riskSummary}</p>
                  <p className={position.pnl >= 0 ? "mt-2 text-xs text-emerald-300" : "mt-2 text-xs text-rose-300"}>
                    {formatCurrency(position.pnl, currency, 2)} · {formatPercent(position.pnlPercent)}
                  </p>
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
  );
}

