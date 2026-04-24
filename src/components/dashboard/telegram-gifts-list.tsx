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
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
            Gift value
          </p>
          <p className="mt-3 text-2xl font-semibold text-white">
            {formatCurrency(totalValue, currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
            Total items
          </p>
          <p className="mt-3 text-2xl font-semibold text-white">
            {formatNumber(totalCount, 0)}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/30">
        <div className="grid grid-cols-[1.6fr_0.7fr_0.8fr_1.3fr] gap-3 border-b border-white/10 px-4 py-3 text-xs uppercase tracking-[0.22em] text-slate-400">
          <span>Name</span>
          <span>Qty</span>
          <span>Price</span>
          <span>Notes</span>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {positions.length === 0 ? (
            <div className="px-4 py-8 text-sm text-slate-400">
              No Telegram Gifts found in the connected sheet.
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
                    {position.priceSource}
                  </p>
                </div>
                <span>{formatNumber(position.quantity, 0)}</span>
                <span>
                  {position.estimatedPrice !== null
                    ? formatCurrency(position.estimatedPrice, currency)
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
