"use client";

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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
        <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-emerald-200">
          {liveCount}/{positions.length} live-котировок
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
                <div className="text-right">
                  <p className="font-medium text-white">{formatCurrency(position.totalValue, currency, 2)}</p>
                  <p className="mt-1 text-xs text-slate-400">{position.name}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
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
        <div className="grid grid-cols-[0.8fr_1.35fr_0.8fr_1fr_1fr_1fr_0.9fr_0.9fr] gap-3 border-b border-white/10 px-4 py-3 text-xs uppercase tracking-[0.22em] text-slate-400">
          <span>Тикер</span>
          <span>Актив</span>
          <span>Кол-во</span>
          <span>Вход</span>
          <span>Текущая</span>
          <span>Стоимость</span>
          <span>PnL</span>
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
                className="grid grid-cols-[0.8fr_1.35fr_0.8fr_1fr_1fr_1fr_0.9fr_0.9fr] gap-3 border-b border-white/6 px-4 py-4 text-sm text-slate-200 last:border-b-0"
              >
                <span className="font-medium text-white">{position.symbol}</span>
                <div>
                  <p className="font-medium text-white">{position.name}</p>
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
                <span>{formatCurrency(position.totalValue, currency, 2)}</span>
                <span className={position.pnl >= 0 ? "text-emerald-300" : "text-rose-300"}>
                  <span>{formatCurrency(position.pnl, currency, 2)}</span>
                  <span className="block text-xs opacity-80">{formatPercent(position.pnlPercent)}</span>
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
    </div>
  );
}
