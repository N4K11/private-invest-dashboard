import { formatCurrency, formatNumber } from "@/lib/utils";
import type { SaasSharedAllocationRow } from "@/types/saas";

type SharedAllocationBreakdownProps = {
  allocation: SaasSharedAllocationRow[];
  baseCurrency: string;
};

export function SharedAllocationBreakdown({
  allocation,
  baseCurrency,
}: SharedAllocationBreakdownProps) {
  return (
    <div className="space-y-4">
      {allocation.map((row) => (
        <article key={row.category} className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-white">{row.label}</p>
              <p className="mt-2 text-sm text-slate-400">{formatNumber(row.weight, 1)}% портфеля</p>
            </div>
            <div className="text-right text-sm text-slate-300/78">
              <p>{row.value === null ? "Значение скрыто" : formatCurrency(row.value, baseCurrency, 2)}</p>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full" style={{ width: `${Math.max(Math.min(row.weight, 100), 0)}%`, backgroundColor: row.color }} />
          </div>
        </article>
      ))}
    </div>
  );
}