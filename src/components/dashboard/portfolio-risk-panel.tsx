import { RecommendationBadge } from "@/components/dashboard/recommendation-badge";
import { formatAssetCategoryLabel } from "@/lib/presentation";
import { cn, formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import type { PortfolioRiskAnalytics } from "@/types/portfolio";

function RiskMetricCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "warning" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border p-4",
        tone === "danger"
          ? "border-rose-400/18 bg-rose-400/8"
          : tone === "warning"
            ? "border-amber-300/18 bg-amber-300/8"
            : "border-white/10 bg-white/5",
      )}
    >
      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-400">{hint}</p>
    </div>
  );
}

function ExposureBar({
  label,
  weight,
  value,
  color,
  currency,
}: {
  label: string;
  weight: number;
  value: number;
  color: string;
  currency: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-white">{label}</p>
          <p className="mt-1 text-xs text-slate-400">{formatCurrency(value, currency, 2)}</p>
        </div>
        <p className="text-sm font-medium text-white">{formatPercent(weight)}</p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/6">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(weight, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function RiskPositionRow({
  item,
  currency,
}: {
  item: PortfolioRiskAnalytics["highRiskPositions"][number];
  currency: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/25 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-white">{item.name}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
            {formatAssetCategoryLabel(item.category)}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-200">
            Риск {item.riskScore}
          </span>
          <RecommendationBadge recommendation={item.recommendation} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-300">
        <span>{formatCurrency(item.value, currency, 2)}</span>
        <span>{formatPercent(item.weight)}</span>
        <span>{formatNumber(item.quantity, 0)} шт.</span>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-300/86">{item.riskSummary}</p>
    </div>
  );
}

function CompactRiskList({
  title,
  description,
  items,
  currency,
}: {
  title: string;
  description: string;
  items: PortfolioRiskAnalytics["topByValue"];
  currency: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">Пока нет данных.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-slate-950/25 px-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-white">{item.name}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {formatAssetCategoryLabel(item.category)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-medium text-white">{formatCurrency(item.value, currency, 2)}</p>
                <p className="mt-1 text-xs text-slate-400">{formatPercent(item.weight)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function PortfolioRiskPanel({
  risk,
  currency,
}: {
  risk: PortfolioRiskAnalytics;
  currency: string;
}) {
  const scoreTone =
    risk.portfolioRiskScore >= 72
      ? "danger"
      : risk.portfolioRiskScore >= 48
        ? "warning"
        : "neutral";

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <RiskMetricCard
          label="Общий риск"
          value={`${risk.portfolioRiskScore}/100`}
          hint="Взвешенный score по концентрации, полноте цен, ликвидности и stale/manual pricing."
          tone={scoreTone}
        />
        <RiskMetricCard
          label="Макс. концентрация"
          value={formatPercent(risk.maxPositionWeight)}
          hint="Какая доля портфеля сейчас сидит в одной крупнейшей позиции."
          tone={risk.maxPositionWeight >= 15 ? "warning" : "neutral"}
        />
        <RiskMetricCard
          label="High-risk позиции"
          value={formatNumber(risk.highRiskCount, 0)}
          hint="Позиции с рекомендацией trim / illiquid / needs price update или score выше порога."
          tone={risk.highRiskCount > 0 ? "warning" : "neutral"}
        />
        <RiskMetricCard
          label="Проблемы цен"
          value={`${formatNumber(risk.missingPriceCount, 0)} / ${formatNumber(risk.stalePriceCount, 0)}`}
          hint="Сначала missing, потом stale. Эти позиции искажают общую оценку быстрее всего."
          tone={risk.missingPriceCount > 0 || risk.stalePriceCount > 0 ? "danger" : "neutral"}
        />
      </div>

      <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(7,16,31,0.9),rgba(7,27,44,0.82))] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Risk summary</p>
            <p className="max-w-4xl text-sm leading-7 text-slate-200/88">{risk.portfolioRiskSummary}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-300 lg:max-w-sm">
            Это аналитические сигналы для приоритизации внимания: обновить цену, проверить ликвидность, снизить концентрацию. Не инвестиционный совет.
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Экспозиция по категориям</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Быстрый срез, где именно сосредоточен капитал: CS2, Telegram Gifts или крипта.
            </p>
            <div className="mt-4 space-y-3">
              {risk.categoryExposure.map((item) => (
                <ExposureBar
                  key={item.category}
                  label={item.label}
                  weight={item.weight}
                  value={item.value}
                  color={item.color}
                  currency={currency}
                />
              ))}
            </div>
          </div>

          <CompactRiskList
            title="Топ по количеству"
            description="Позиции, где количество само по себе может создать операционную нагрузку или риск неликвидного хвоста."
            items={risk.topByQuantity}
            currency={currency}
          />
        </div>

        <div className="space-y-4">
          <CompactRiskList
            title="Топ по стоимости"
            description="Крупнейшие позиции по доле в капитале. Это главный источник концентрационного риска."
            items={risk.topByValue}
            currency={currency}
          />

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">High-risk watchlist</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Позиции, которым сейчас нужно действие: перепрайсинг, проверка ликвидности или сокращение доли.
            </p>
            <div className="mt-4 space-y-3">
              {risk.highRiskPositions.length === 0 ? (
                <div className="rounded-3xl border border-emerald-400/18 bg-emerald-400/8 px-4 py-4 text-sm text-emerald-100">
                  Критичных позиций по текущим правилам не найдено.
                </div>
              ) : (
                risk.highRiskPositions.map((item) => (
                  <RiskPositionRow key={item.id} item={item} currency={currency} />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

