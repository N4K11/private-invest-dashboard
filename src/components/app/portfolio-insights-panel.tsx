import { DashboardStatePanel } from "@/components/dashboard/dashboard-state-panel";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { SaasPortfolioInsights } from "@/types/saas";

const toneStyles: Record<
  SaasPortfolioInsights["sections"][number]["items"][number]["tone"],
  {
    container: string;
    badge: string;
    metric: string;
  }
> = {
  neutral: {
    container: "border-white/10 bg-white/[0.03]",
    badge: "border-cyan-300/18 bg-cyan-300/10 text-cyan-100",
    metric: "border-white/10 bg-white/5 text-slate-100",
  },
  positive: {
    container: "border-emerald-300/18 bg-emerald-300/[0.07]",
    badge: "border-emerald-300/22 bg-emerald-300/14 text-emerald-100",
    metric: "border-emerald-300/18 bg-emerald-300/10 text-emerald-50",
  },
  warning: {
    container: "border-amber-300/18 bg-amber-300/[0.07]",
    badge: "border-amber-300/22 bg-amber-300/14 text-amber-100",
    metric: "border-amber-300/18 bg-amber-300/10 text-amber-50",
  },
  critical: {
    container: "border-rose-400/18 bg-rose-400/[0.07]",
    badge: "border-rose-400/22 bg-rose-400/14 text-rose-100",
    metric: "border-rose-400/18 bg-rose-400/10 text-rose-50",
  },
};

const toneLabels: Record<SaasPortfolioInsights["sections"][number]["items"][number]["tone"], string> = {
  neutral: "Стабильно",
  positive: "Позитивно",
  warning: "Нужен контроль",
  critical: "Высокий приоритет",
};

function InsightItemCard({
  item,
}: {
  item: SaasPortfolioInsights["sections"][number]["items"][number];
}) {
  const palette = toneStyles[item.tone];

  return (
    <article className={cn("rounded-[26px] border p-4 sm:p-5", palette.container)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-white">{item.title}</p>
          <p className="mt-3 text-sm leading-7 text-slate-100/86">{item.summary}</p>
        </div>
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-[0.68rem] uppercase tracking-[0.22em]",
            palette.badge,
          )}
        >
          {toneLabels[item.tone]}
        </span>
      </div>

      {item.metrics.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {item.metrics.map((metric) => (
            <div
              key={`${item.id}-${metric.label}`}
              className={cn("rounded-2xl border px-3 py-2 text-sm", palette.metric)}
            >
              <span className="text-slate-300/82">{metric.label}:</span> {metric.value}
            </div>
          ))}
        </div>
      ) : null}

      {item.details.length > 0 ? (
        <div className="mt-4 space-y-2 text-sm leading-7 text-slate-200/82">
          {item.details.map((detail) => (
            <p key={`${item.id}-${detail}`}>{detail}</p>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function PortfolioInsightsPanel({
  insights,
}: {
  insights: SaasPortfolioInsights;
}) {
  const itemCount = insights.sections.reduce((sum, section) => sum + section.items.length, 0);

  if (insights.sections.length === 0 || itemCount === 0) {
    return (
      <DashboardStatePanel
        eyebrow="Insights"
        title="Инсайты пока не сформированы"
        description="Когда появятся позиции, snapshots и risk-signals, здесь появится structured commentary по портфелю."
        className="min-h-[220px]"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[30px] border border-cyan-300/18 bg-[linear-gradient(135deg,rgba(7,16,31,0.96),rgba(13,43,65,0.86))] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[0.68rem] uppercase tracking-[0.32em] text-cyan-200/72">
              AI insights layer
            </p>
            <h3 className="mt-3 text-2xl font-semibold text-white sm:text-[1.8rem]">
              {insights.headline}
            </h3>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200/82">
              Текущая версия полностью deterministic и работает только на основе уже рассчитанных analytics, price snapshots и quality flags внутри текущего workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[0.68rem] uppercase tracking-[0.2em] text-slate-200/82">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {insights.deterministic ? "Deterministic" : "Provider"}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {insights.providerId}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Обновлено {formatRelativeTime(insights.generatedAt)}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-[26px] border border-amber-300/20 bg-amber-300/[0.08] px-5 py-4 text-sm leading-7 text-amber-50/92">
        {insights.disclaimer}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {insights.sections.map((section) => (
          <section
            key={section.id}
            className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">{section.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300/74">{section.description}</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.68rem] uppercase tracking-[0.22em] text-slate-300/84">
                {section.items.length} insights
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {section.items.map((item) => (
                <InsightItemCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}