import { formatCompactNumber, formatCurrency, formatPercent } from "@/lib/utils";
import type { SummaryCardDatum } from "@/types/portfolio";

type SummaryCardProps = {
  card: SummaryCardDatum;
  currency: string;
};

function formatCardValue(card: SummaryCardDatum, currency: string) {
  if (typeof card.value === "string") {
    return card.value;
  }

  if (card.id === "net-roi") {
    return formatPercent(card.value);
  }

  if (card.id === "positions-count") {
    return formatCompactNumber(card.value);
  }

  return formatCurrency(card.value, currency);
}

const toneClasses: Record<NonNullable<SummaryCardDatum["tone"]>, string> = {
  neutral: "from-white/12 to-white/4 text-white",
  positive: "from-emerald-400/20 to-emerald-400/5 text-emerald-100",
  negative: "from-rose-400/20 to-rose-400/5 text-rose-100",
};

export function SummaryCard({ card, currency }: SummaryCardProps) {
  return (
    <article className="panel metric-sheen rounded-[26px] border border-white/10 px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
            {card.label}
          </p>
          <p
            className={`mt-4 bg-gradient-to-br ${toneClasses[card.tone ?? "neutral"]} bg-clip-text text-3xl font-semibold tracking-tight text-transparent`}
          >
            {formatCardValue(card, currency)}
          </p>
        </div>
      </div>
      <p className="mt-5 text-sm leading-6 text-slate-300/75">{card.hint}</p>
    </article>
  );
}
