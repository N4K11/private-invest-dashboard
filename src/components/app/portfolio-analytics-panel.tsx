import { AssetClassHistoryChart } from "@/components/dashboard/asset-class-history-chart";
import { PortfolioPnlHistoryChart } from "@/components/dashboard/portfolio-pnl-history-chart";
import { PortfolioValueHistoryChart } from "@/components/dashboard/portfolio-value-history-chart";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { formatSaasPriceConfidenceLabel } from "@/lib/presentation";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import type { SaasPortfolioAnalytics, SaasPortfolioAnalyticsPosition } from "@/types/saas";

const CATEGORY_LABELS: Record<SaasPortfolioAnalyticsPosition["category"], string> = {
  cs2: "CS2",
  telegram: "Telegram Gifts",
  crypto: "Крипта",
  custom: "Custom",
  nft: "NFT",
};

function ChartCard({
  title,
  description,
  children,
}: React.PropsWithChildren<{
  title: string;
  description: string;
}>) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300/72">{description}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function PositionCard({
  item,
  currency,
}: {
  item: SaasPortfolioAnalyticsPosition;
  currency: string;
}) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-semibold text-white">{item.assetName}</h4>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.7rem] uppercase tracking-[0.18em] text-slate-300/80">
              {CATEGORY_LABELS[item.category]}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.7rem] uppercase tracking-[0.18em] text-slate-300/80">
              {formatSaasPriceConfidenceLabel(item.priceConfidenceStatus)}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            {formatCurrency(item.value, currency)} · {formatPercent(item.weight)} портфеля
          </p>
        </div>
        <div className="text-right">
          <p className={cn("text-sm font-medium", item.totalPnl >= 0 ? "text-emerald-200" : "text-rose-200")}>
            {formatCurrency(item.totalPnl, currency)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {item.roi !== null ? formatPercent(item.roi) : "ROI недоступен"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Реализованный PnL</p>
          <p className="mt-2">{formatCurrency(item.realizedPnl, currency)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Нереализованный PnL</p>
          <p className="mt-2">{formatCurrency(item.unrealizedPnl, currency)}</p>
        </div>
      </div>

      {item.explainability.length > 0 ? (
        <div className="mt-4 space-y-2 text-sm leading-6 text-slate-300/78">
          {item.explainability.map((reason) => (
            <p key={`${item.positionId}-${reason}`}>{reason}</p>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm leading-6 text-slate-400">
          Явных красных флагов по этой позиции сейчас не видно.
        </p>
      )}
    </article>
  );
}

export function PortfolioAnalyticsPanel({
  analytics,
  currency,
}: {
  analytics: SaasPortfolioAnalytics;
  currency: string;
}) {
  return (
    <div className="space-y-6">
      {analytics.warnings.length > 0 ? (
        <div className="grid gap-3">
          {analytics.warnings.map((warning) => (
            <div
              key={warning}
              className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-4 text-sm leading-7 text-amber-50/90"
            >
              {warning}
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {analytics.cards.map((card) => (
          <SummaryCard key={card.id} card={card} currency={currency} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          title="Стоимость во времени"
          description="История общей стоимости портфеля по price snapshots и текущей live valuation-точке."
        >
          <PortfolioValueHistoryChart data={analytics.totalValueHistory} currency={currency} />
        </ChartCard>
        <ChartCard
          title="Распределение по классам"
          description="Как менялась доля CS2, Telegram Gifts, crypto и Other по времени."
        >
          <AssetClassHistoryChart data={analytics.assetClassHistory} currency={currency} />
        </ChartCard>
        <ChartCard
          title="PnL во времени"
          description="Историческая кривая совокупного PnL на базе ledger state и snapshots."
        >
          <PortfolioPnlHistoryChart data={analytics.totalPnlHistory} currency={currency} />
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-4">
          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(7,16,31,0.9),rgba(7,27,44,0.82))] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Concentration risk</p>
            <p className="mt-3 text-lg font-semibold text-white">
              Топ 1: {formatPercent(analytics.concentrationRisk.maxPositionWeight)} · Топ 3: {formatPercent(analytics.concentrationRisk.topThreeWeight)}
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-200/86">
              {analytics.concentrationRisk.summary}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-200">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">ROI портфеля</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {analytics.totalRoi !== null ? formatPercent(analytics.totalRoi) : "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-200">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Качество оценки</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  устаревшие {analytics.stalePriceCount} · слабые {analytics.lowConfidenceValuationCount}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <h3 className="text-lg font-semibold text-white">Топ-позиции</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300/72">
              Крупнейшие позиции по текущей стоимости. Здесь лучше всего видно, где именно концентрируется капитал.
            </p>
            <div className="mt-5 space-y-3">
              {analytics.topPositions.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-400">
                  Для этого портфеля пока нет позиций.
                </p>
              ) : (
                analytics.topPositions.map((item) => (
                  <PositionCard key={item.positionId} item={item} currency={currency} />
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <h3 className="text-lg font-semibold text-white">Watchlist с explainability</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300/72">
            Почему система считает позицию рискованной, устаревшей по цене, слишком концентрированной или слабой по качеству оценки.
          </p>
          <div className="mt-5 space-y-3">
            {analytics.riskWatchlist.length === 0 ? (
              <p className="rounded-2xl border border-emerald-400/18 bg-emerald-400/8 px-4 py-4 text-sm text-emerald-100">
                Позиции без явных risk flags. По текущим правилам watchlist сейчас пуст.
              </p>
            ) : (
              analytics.riskWatchlist.map((item) => (
                <PositionCard key={item.positionId} item={item} currency={currency} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


