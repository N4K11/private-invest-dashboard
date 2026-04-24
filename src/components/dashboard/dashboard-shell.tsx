import { AllocationChart } from "@/components/dashboard/allocation-chart";
import { CategoryPerformanceChart } from "@/components/dashboard/category-performance-chart";
import { Cs2Table } from "@/components/dashboard/cs2-table";
import { Cs2TypeChart } from "@/components/dashboard/cs2-type-chart";
import { CryptoPanel } from "@/components/dashboard/crypto-panel";
import { SectionCard } from "@/components/dashboard/section-card";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { TelegramGiftsList } from "@/components/dashboard/telegram-gifts-list";
import { CATEGORY_META } from "@/lib/constants";
import {
  formatCompactNumber,
  formatCurrency,
  formatPercent,
  formatRelativeTime,
} from "@/lib/utils";
import type { Cs2Position, PortfolioSnapshot, TopHolding } from "@/types/portfolio";

type DashboardShellProps = {
  snapshot: PortfolioSnapshot;
};

function HoldingsList({ holdings, currency }: { holdings: TopHolding[]; currency: string }) {
  return (
    <div className="space-y-3">
      {holdings.map((holding) => (
        <div
          key={holding.id}
          className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3"
        >
          <div>
            <p className="font-medium text-white">{holding.name}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
              {CATEGORY_META[holding.category].label}
            </p>
          </div>
          <div className="text-right">
            <p className="font-medium text-white">{formatCurrency(holding.value, currency)}</p>
            <p className="mt-1 text-xs text-slate-400">{formatPercent(holding.weight)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Cs2MiniList({
  positions,
  currency,
  mode,
}: {
  positions: Cs2Position[];
  currency: string;
  mode: "value" | "risk";
}) {
  return (
    <div className="space-y-3">
      {positions.map((position) => (
        <div
          key={position.id}
          className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3"
        >
          <div>
            <p className="font-medium text-white">{position.name}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
              {position.type}
            </p>
          </div>
          <div className="text-right">
            {mode === "value" ? (
              <>
                <p className="font-medium text-white">
                  {formatCurrency(position.totalValue, currency)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Qty {formatCompactNumber(position.quantity)}
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-white">Risk {position.riskScore}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {position.liquidityLabel} liquidity
                </p>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardShell({ snapshot }: DashboardShellProps) {
  const currency = snapshot.settings.currency ?? "USD";

  return (
    <main className="relative pb-16">
      <div className="mx-auto flex w-full max-w-[1640px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="panel rounded-[32px] border border-white/10 px-6 py-7 shadow-[0_24px_80px_rgba(2,8,23,0.65)] sm:px-8">
          <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr] xl:items-end">
            <div className="space-y-5">
              <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.24em] text-cyan-200/70">
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/8 px-3 py-1">
                  Private asset terminal
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
                  {snapshot.summary.sourceLabel}
                </span>
              </div>
              <div>
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Premium dashboard for CS2 inventory, Telegram Gifts and crypto exposure.
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300/80 sm:text-lg">
                  Hidden route, env-based token gate, Google Sheets as source of truth and live crypto valuation layered on top.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-slate-300">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  Updated {formatRelativeTime(snapshot.summary.lastUpdatedAt)}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  {snapshot.summary.availableSheets.length} sheet tabs connected
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  {snapshot.summary.positionsCount.toLocaleString("en-US")} tracked positions
                </span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              {snapshot.summary.breakdown.map((item) => (
                <div
                  key={item.category}
                  className="rounded-[24px] border border-white/10 bg-white/5 p-4"
                >
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-white">
                    {formatCurrency(item.value, currency)}
                  </p>
                  <p className="mt-2 text-sm text-slate-300/75">
                    {item.positions} positions • {formatCompactNumber(item.items)} units
                  </p>
                </div>
              ))}
            </div>
          </div>

          {snapshot.summary.warnings.length > 0 ? (
            <div className="mt-6 rounded-[24px] border border-amber-300/20 bg-amber-300/8 px-5 py-4 text-sm text-amber-100/90">
              <p className="text-xs uppercase tracking-[0.24em] text-amber-200/70">
                Data warnings
              </p>
              <div className="mt-3 space-y-2">
                {snapshot.summary.warnings.slice(0, 4).map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {snapshot.summary.cards.map((card) => (
            <SummaryCard key={card.id} card={card} currency={currency} />
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <SectionCard
            title="Allocation"
            eyebrow="Portfolio mix"
            description="Asset class exposure based on current marked value."
          >
            <AllocationChart data={snapshot.charts.allocation} currency={currency} />
          </SectionCard>
          <SectionCard
            title="Cost vs Value"
            eyebrow="Category performance"
            description="Shows how current marked value compares to known cost basis."
          >
            <CategoryPerformanceChart
              data={snapshot.charts.categoryPerformance}
              currency={currency}
            />
          </SectionCard>
          <SectionCard
            title="CS2 Type Mix"
            eyebrow="Inventory composition"
            description="Current CS2 value split by stickers, skins, cases and other buckets."
          >
            <Cs2TypeChart data={snapshot.charts.cs2ByType} currency={currency} />
          </SectionCard>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <SectionCard
            title="Top Holdings"
            eyebrow="Concentration"
            description="Largest cross-category positions by marked value."
          >
            <HoldingsList holdings={snapshot.summary.topHoldings} currency={currency} />
          </SectionCard>
          <SectionCard
            title="Largest CS2 Positions"
            eyebrow="Top 10"
            description="Highest-value CS2 exposures at current sheet pricing."
          >
            <Cs2MiniList
              positions={snapshot.cs2.topPositions}
              currency={currency}
              mode="value"
            />
          </SectionCard>
          <SectionCard
            title="Risk / Illiquid"
            eyebrow="Top 10"
            description="Heuristic ranking combining concentration, missing prices and niche liquidity."
          >
            <Cs2MiniList
              positions={snapshot.cs2.riskPositions}
              currency={currency}
              mode="risk"
            />
          </SectionCard>
        </section>

        <SectionCard
          title="CS2 Positions"
          eyebrow="Interactive inventory"
          description="Search, filter and sort the full CS2 inventory without exposing data publicly outside the private route."
        >
          <Cs2Table positions={snapshot.cs2.positions} currency={currency} />
        </SectionCard>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <SectionCard
            title="Telegram Gifts"
            eyebrow="Manual price lane"
            description="Prices remain sheet-driven until an external provider is connected."
          >
            <TelegramGiftsList
              positions={snapshot.telegramGifts.positions}
              currency={currency}
            />
          </SectionCard>
          <SectionCard
            title="Crypto"
            eyebrow="Live quotes"
            description="BTC and mapped symbols refresh from CoinGecko, with sheet fallback when the API is unavailable."
          >
            <CryptoPanel positions={snapshot.crypto.positions} currency={currency} />
          </SectionCard>
        </section>
      </div>
    </main>
  );
}
