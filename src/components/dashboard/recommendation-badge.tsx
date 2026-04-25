import { formatRecommendationLabel } from "@/lib/presentation";
import { cn } from "@/lib/utils";
import type { PositionRecommendation } from "@/types/portfolio";

const recommendationTone: Record<PositionRecommendation, string> = {
  hold: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
  watch: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  consider_trimming: "border-fuchsia-300/25 bg-fuchsia-300/10 text-fuchsia-100",
  needs_price_update: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
  illiquid: "border-rose-400/25 bg-rose-400/10 text-rose-100",
};

export function RecommendationBadge({
  recommendation,
  className,
}: {
  recommendation: PositionRecommendation;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em]",
        recommendationTone[recommendation],
        className,
      )}
    >
      {formatRecommendationLabel(recommendation)}
    </span>
  );
}

