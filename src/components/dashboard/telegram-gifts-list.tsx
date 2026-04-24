import { formatPriceSourceLabel } from "@/lib/presentation";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { TelegramGiftPosition } from "@/types/portfolio";

type TelegramGiftsListProps = {
  positions: TelegramGiftPosition[];
  currency: string;
};

export function TelegramGiftsList({
  positions,
  currency,
}: TelegramGiftsListProps) {
  const totalValue = positions.reduce((sum, item) => sum + item.totalValue, 0);
  const totalCount = positions.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
            Стоимость подарков
          </p>
          <p className="mt-3 text-2xl font-semibold text-white">
            {formatCurrency(totalValue, currency, 2)}
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
            Всего предметов
          </p>
          <p className="mt-3 text-2xl font-semibold text-white">
            {formatNumber(totalCount, 0)}
          </p>
        </div>
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
                </div>
                <div className="text-right">
                  <p className="font-medium text-white">{formatCurrency(position.totalValue, currency, 2)}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatNumber(position.quantity, 0)} шт.</p>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Цена за единицу</p>
                <p className="mt-2 text-white">
                  {position.estimatedPrice !== null
                    ? formatCurrency(position.estimatedPrice, currency, 2)
                    : "—"}
                </p>
                <p className="mt-2 text-xs text-slate-400">{position.notes ?? "Без комментария"}</p>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-white/10 bg-slate-950/30 lg:block">
        <div className="grid grid-cols-[1.6fr_0.7fr_0.8fr_1.3fr] gap-3 border-b border-white/10 px-4 py-3 text-xs uppercase tracking-[0.22em] text-slate-400">
          <span>Название</span>
          <span>Кол-во</span>
          <span>Цена</span>
          <span>Примечание</span>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {positions.length === 0 ? (
            <div className="px-4 py-8 text-sm text-slate-400">
              В подключенной таблице пока нет подарков Telegram.
            </div>
          ) : (
            positions.map((position) => (
              <div
                key={position.id}
                className="grid grid-cols-[1.6fr_0.7fr_0.8fr_1.3fr] gap-3 border-b border-white/6 px-4 py-4 text-sm text-slate-200 last:border-b-0"
              >
                <div>
                  <p className="font-medium text-white">{position.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-200/55">
                    {formatPriceSourceLabel(position.priceSource)}
                  </p>
                </div>
                <span>{formatNumber(position.quantity, 0)}</span>
                <span>
                  {position.estimatedPrice !== null
                    ? formatCurrency(position.estimatedPrice, currency, 2)
                    : "—"}
                </span>
                <span className="text-slate-400">{position.notes ?? "—"}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

