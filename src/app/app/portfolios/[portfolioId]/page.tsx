import type { Metadata } from "next";

import Link from "next/link";
import { notFound } from "next/navigation";

import { ManualAssetManager } from "@/components/app/manual-asset-manager";
import { PortfolioShareLinksPanel } from "@/components/app/portfolio-share-links-panel";
import { PortfolioInsightsPanel } from "@/components/app/portfolio-insights-panel";
import { PortfolioAnalyticsPanel } from "@/components/app/portfolio-analytics-panel";
import { TelegramGiftPricingPanel } from "@/components/app/telegram-gift-pricing-panel";
import { AllocationChart } from "@/components/dashboard/allocation-chart";
import { CategoryPerformanceChart } from "@/components/dashboard/category-performance-chart";
import { DashboardStatePanel } from "@/components/dashboard/dashboard-state-panel";
import { SectionCard } from "@/components/dashboard/section-card";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { getActiveWorkspaceSlug } from "@/lib/auth/active-workspace";
import { requireAppSession } from "@/lib/auth/session";
import { getCurrentUserWorkspaceContext } from "@/lib/auth/workspace";
import { formatTransactionActionLabel } from "@/lib/presentation";
import { getPortfolioDetailForUser } from "@/lib/saas/portfolios";
import { listShareLinksForPortfolioForUser } from "@/lib/saas/sharing";
import { formatCurrency, formatNumber, formatRelativeTime } from "@/lib/utils";
import type { SaasAssetCategory, SaasPortfolioVisibility } from "@/types/saas";

const CATEGORY_LABELS: Record<SaasAssetCategory, string> = {
  cs2: "CS2",
  telegram: "Telegram Gifts",
  crypto: "Р В РЎв„ўР РЋР вЂљР В РЎвЂР В РЎвЂ”Р РЋРІР‚С™Р В Р’В°",
  custom: "Custom",
  nft: "NFT",
};

const VISIBILITY_LABELS: Record<SaasPortfolioVisibility, string> = {
  private: "Private",
  shared_link: "Shared link",
  workspace: "Р В РІР‚в„ўР В Р вЂ¦Р РЋРЎвЂњР РЋРІР‚С™Р РЋР вЂљР В РЎвЂ workspace",
};

function formatCategoryLabel(category: SaasAssetCategory) {
  return CATEGORY_LABELS[category] ?? category;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}): Promise<Metadata> {
  const { portfolioId } = await params;

  return {
    title: `Portfolio ${portfolioId}`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function PortfolioDetailPage({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}) {
  const session = await requireAppSession();
  const { portfolioId } = await params;
  const activeWorkspaceSlug = await getActiveWorkspaceSlug();
  await getCurrentUserWorkspaceContext(session.user.id, {
    preferredWorkspaceSlug: activeWorkspaceSlug ?? session.user.workspaceSlug ?? null,
  });

  const portfolio = await getPortfolioDetailForUser(session.user.id, portfolioId);

  if (!portfolio) {
    notFound();
  }

  const shareLinks = portfolio.canManage
    ? await listShareLinksForPortfolioForUser(session.user.id, portfolio.id)
    : [];
  return (
    <main className="space-y-6">
      <section className="panel rounded-[32px] border border-white/10 px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">
              Portfolio detail
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
              {portfolio.name}
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-300/80 sm:text-base">
              Database-backed detail page Р В РўвЂР В Р’В»Р РЋР РЏ SaaS-Р В РЎвЂ”Р В РЎвЂўР РЋР вЂљР РЋРІР‚С™Р РЋРІР‚С›Р В Р’ВµР В Р’В»Р РЋР РЏ. Р В РІР‚вЂќР В РўвЂР В Р’ВµР РЋР С“Р РЋР Р‰ Р РЋРЎвЂњР В Р’В¶Р В Р’Вµ Р РЋР вЂљР В Р’В°Р В Р’В±Р В РЎвЂўР РЋРІР‚С™Р В Р’В°Р РЋР вЂ№Р РЋРІР‚С™ summary cards, allocation charts, Р РЋРІР‚С™Р В Р’В°Р В Р’В±Р В Р’В»Р В РЎвЂР РЋРІР‚В Р В Р’В° Р В РЎвЂ”Р В РЎвЂўР В Р’В·Р В РЎвЂР РЋРІР‚В Р В РЎвЂР В РІвЂћвЂ“, Р В РЎвЂ”Р В РЎвЂўР РЋР С“Р В Р’В»Р В Р’ВµР В РўвЂР В Р вЂ¦Р В РЎвЂР В Р’Вµ Р РЋРІР‚С™Р РЋР вЂљР В Р’В°Р В Р вЂ¦Р В Р’В·Р В Р’В°Р В РЎвЂќР РЋРІР‚В Р В РЎвЂР В РЎвЂ Р В РЎвЂ Р В РЎвЂўР РЋРІР‚С™Р В РўвЂР В Р’ВµР В Р’В»Р РЋР Р‰Р В Р вЂ¦Р РЋРІР‚в„–Р В РІвЂћвЂ“ OTC pricing workflow Р В РўвЂР В Р’В»Р РЋР РЏ Telegram Gifts.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs uppercase tracking-[0.2em] text-slate-300/80">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {VISIBILITY_LABELS[portfolio.visibility]}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {portfolio.baseCurrency}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                risk: {portfolio.riskProfile ?? "balanced"}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                role: {portfolio.role}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/app/portfolios"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-white/20 hover:text-white"
            >
              Р В РЎв„ўР В РЎвЂў Р В Р вЂ Р РЋР С“Р В Р’ВµР В РЎВ Р В РЎвЂ”Р В РЎвЂўР РЋР вЂљР РЋРІР‚С™Р РЋРІР‚С›Р В Р’ВµР В Р’В»Р РЋР РЏР В РЎВ
            </Link>
            <Link
              href="/app/settings"
              className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Р В РЎСљР В Р’В°Р РЋР С“Р РЋРІР‚С™Р РЋР вЂљР В РЎвЂўР В РІвЂћвЂ“Р В РЎвЂќР В РЎвЂ workspace
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {portfolio.cards.map((card) => (
          <SummaryCard key={card.id} card={card} currency={portfolio.baseCurrency} />
        ))}
      </section>

      {portfolio.warnings.length > 0 ? (
        <SectionCard
          eyebrow="Data quality"
          title="Р В РЎСџР РЋР вЂљР В Р’ВµР В РўвЂР РЋРЎвЂњР В РЎвЂ”Р РЋР вЂљР В Р’ВµР В Р’В¶Р В РўвЂР В Р’ВµР В Р вЂ¦Р В РЎвЂР РЋР РЏ Р В РЎвЂ”Р В РЎвЂў Р В РўвЂР В Р’В°Р В Р вЂ¦Р В Р вЂ¦Р РЋРІР‚в„–Р В РЎВ"
          description="Р В Р’В­Р РЋРІР‚С™Р В РЎвЂ Р РЋР С“Р В РЎвЂР В РЎвЂ“Р В Р вЂ¦Р В Р’В°Р В Р’В»Р РЋРІР‚в„– Р В РЎвЂ”Р В РЎвЂўР В РЎВР В РЎвЂўР В РЎвЂ“Р В Р’В°Р РЋР вЂ№Р РЋРІР‚С™ Р В РЎвЂ”Р В РЎвЂўР В Р вЂ¦Р РЋР РЏР РЋРІР‚С™Р РЋР Р‰, Р В РЎвЂ”Р В РЎвЂўР РЋРІР‚РЋР В Р’ВµР В РЎВР РЋРЎвЂњ Р В РЎвЂўР РЋРІР‚В Р В Р’ВµР В Р вЂ¦Р В РЎвЂќР В Р’В° Р В РЎвЂ”Р В РЎвЂўР РЋР вЂљР РЋРІР‚С™Р РЋРІР‚С›Р В Р’ВµР В Р’В»Р РЋР РЏ Р В РЎВР В РЎвЂўР В Р’В¶Р В Р’ВµР РЋРІР‚С™ Р В Р’В±Р РЋРІР‚в„–Р РЋРІР‚С™Р РЋР Р‰ Р В Р вЂ¦Р В Р’ВµР В РЎвЂ”Р В РЎвЂўР В Р’В»Р В Р вЂ¦Р В РЎвЂўР В РІвЂћвЂ“ Р В РЎвЂР В Р’В»Р В РЎвЂ Р В РЎВР В Р’ВµР В Р вЂ¦Р В Р’ВµР В Р’Вµ Р РЋРІР‚С™Р В РЎвЂўР РЋРІР‚РЋР В Р вЂ¦Р В РЎвЂўР В РІвЂћвЂ“."
        >
          <div className="grid gap-3">
            {portfolio.warnings.map((warning) => (
              <div
                key={warning}
                className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-4 text-sm leading-7 text-amber-50/90"
              >
                {warning}
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}
      <SectionCard
        eyebrow="Insights"
        title="Р В Р Р‹Р РЋРІР‚С™Р РЋР вЂљР РЋРЎвЂњР В РЎвЂќР РЋРІР‚С™Р РЋРЎвЂњР РЋР вЂљР В РЎвЂР РЋР вЂљР В РЎвЂўР В Р вЂ Р В Р’В°Р В Р вЂ¦Р В Р вЂ¦Р РЋРІР‚в„–Р В Р’Вµ Р В РЎвЂР В Р вЂ¦Р РЋР С“Р В Р’В°Р В РІвЂћвЂ“Р РЋРІР‚С™Р РЋРІР‚в„–"
        description="Deterministic insights layer Р В РЎвЂ”Р В РЎвЂўР В Р вЂ Р В Р’ВµР РЋР вЂљР РЋРІР‚В¦ analytics, snapshots Р В РЎвЂ quality flags. Р В РІР‚вЂќР В РўвЂР В Р’ВµР РЋР С“Р РЋР Р‰ Р В Р вЂ¦Р В Р’ВµР РЋРІР‚С™ Р РЋРІР‚С›Р В РЎвЂР В Р вЂ¦Р В Р’В°Р В Р вЂ¦Р РЋР С“Р В РЎвЂўР В Р вЂ Р РЋРІР‚в„–Р РЋРІР‚В¦ Р РЋР С“Р В РЎвЂўР В Р вЂ Р В Р’ВµР РЋРІР‚С™Р В РЎвЂўР В Р вЂ , Р РЋРІР‚С™Р В РЎвЂўР В Р’В»Р РЋР Р‰Р В РЎвЂќР В РЎвЂў Р РЋР С“Р РЋРІР‚С™Р РЋР вЂљР РЋРЎвЂњР В РЎвЂќР РЋРІР‚С™Р РЋРЎвЂњР РЋР вЂљР В Р вЂ¦Р В РЎвЂўР В Р’Вµ Р В РЎвЂўР В Р’В±Р РЋР вЂ°Р РЋР РЏР РЋР С“Р В Р вЂ¦Р В Р’ВµР В Р вЂ¦Р В РЎвЂР В Р’Вµ Р РЋРІР‚С™Р В Р’ВµР В РЎвЂќР РЋРЎвЂњР РЋРІР‚В°Р В Р’ВµР В РІвЂћвЂ“ Р В РЎвЂќР В Р’В°Р РЋР вЂљР РЋРІР‚С™Р В РЎвЂР В Р вЂ¦Р РЋРІР‚в„– Р В РЎвЂ”Р В РЎвЂўР РЋР вЂљР РЋРІР‚С™Р РЋРІР‚С›Р В Р’ВµР В Р’В»Р РЋР РЏ."
      >
        <PortfolioInsightsPanel insights={portfolio.insights} />
      </SectionCard>

      <section className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          eyebrow="Allocation"
          title="Р В Р Р‹Р РЋРІР‚С™Р РЋР вЂљР РЋРЎвЂњР В РЎвЂќР РЋРІР‚С™Р РЋРЎвЂњР РЋР вЂљР В Р’В° Р В РЎвЂ”Р В РЎвЂўР РЋР вЂљР РЋРІР‚С™Р РЋРІР‚С›Р В Р’ВµР В Р’В»Р РЋР РЏ"
          description="Р В Р’В Р В Р’В°Р РЋР С“Р В РЎвЂ”Р РЋР вЂљР В Р’ВµР В РўвЂР В Р’ВµР В Р’В»Р В Р’ВµР В Р вЂ¦Р В РЎвЂР В Р’Вµ Р РЋРІР‚С™Р В Р’ВµР В РЎвЂќР РЋРЎвЂњР РЋРІР‚В°Р В Р’ВµР В РІвЂћвЂ“ Р РЋР С“Р РЋРІР‚С™Р В РЎвЂўР В РЎвЂР В РЎВР В РЎвЂўР РЋР С“Р РЋРІР‚С™Р В РЎвЂ Р В РЎвЂ”Р В РЎвЂў Р В РЎвЂќР В Р’В°Р РЋРІР‚С™Р В Р’ВµР В РЎвЂ“Р В РЎвЂўР РЋР вЂљР В РЎвЂР РЋР РЏР В РЎВ Р В Р’В°Р В РЎвЂќР РЋРІР‚С™Р В РЎвЂР В Р вЂ Р В РЎвЂўР В Р вЂ ."
        >
          <AllocationChart data={portfolio.allocation} currency={portfolio.baseCurrency} />
        </SectionCard>

        <SectionCard
          eyebrow="Cost vs Value"
          title="Р В Р Р‹Р В Р’ВµР В Р’В±Р В Р’ВµР РЋР С“Р РЋРІР‚С™Р В РЎвЂўР В РЎвЂР В РЎВР В РЎвЂўР РЋР С“Р РЋРІР‚С™Р РЋР Р‰ Р В РЎвЂ”Р РЋР вЂљР В РЎвЂўР РЋРІР‚С™Р В РЎвЂР В Р вЂ  Р В РЎвЂўР РЋРІР‚В Р В Р’ВµР В Р вЂ¦Р В РЎвЂќР В РЎвЂ"
          description="Р В РЎСџР В РЎвЂўР В РЎВР В РЎвЂўР В РЎвЂ“Р В Р’В°Р В Р’ВµР РЋРІР‚С™ Р В Р’В±Р РЋРІР‚в„–Р РЋР С“Р РЋРІР‚С™Р РЋР вЂљР В РЎвЂў Р РЋРЎвЂњР В Р вЂ Р В РЎвЂР В РўвЂР В Р’ВµР РЋРІР‚С™Р РЋР Р‰, Р В РЎвЂќР В Р’В°Р В РЎвЂќР В Р’В°Р РЋР РЏ Р В РЎвЂќР В Р’В°Р РЋРІР‚С™Р В Р’ВµР В РЎвЂ“Р В РЎвЂўР РЋР вЂљР В РЎвЂР РЋР РЏ Р РЋРЎвЂњР В Р’В¶Р В Р’Вµ Р В Р вЂ  Р В РЎвЂ”Р В Р’В»Р РЋР вЂ№Р РЋР С“Р В Р’В°Р РЋРІР‚В¦, Р В Р’В° Р В РЎвЂќР В Р’В°Р В РЎвЂќР В Р’В°Р РЋР РЏ Р В Р’ВµР РЋРІР‚В°Р В Р’Вµ Р РЋРІР‚С™Р В РЎвЂўР В Р’В»Р РЋР Р‰Р В РЎвЂќР В РЎвЂў Р В Р вЂ  Р В Р вЂ¦Р В Р’В°Р В Р’В±Р В РЎвЂўР РЋР вЂљР В Р’Вµ Р В РЎвЂ”Р В РЎвЂўР В Р’В·Р В РЎвЂР РЋРІР‚В Р В РЎвЂР В РЎвЂ."
        >
          <CategoryPerformanceChart
            data={portfolio.categoryPerformance}
            currency={portfolio.baseCurrency}
          />
        </SectionCard>
      </section>

      <SectionCard
        eyebrow="Analytics v1"
        title="Portfolio analytics"
        description="DB-backed analytics layer Р В РЎвЂ”Р В РЎвЂўР В Р вЂ Р В Р’ВµР РЋР вЂљР РЋРІР‚В¦ positions, transactions Р В РЎвЂ price snapshots: Р В РЎвЂР РЋР С“Р РЋРІР‚С™Р В РЎвЂўР РЋР вЂљР В РЎвЂР РЋР РЏ Р РЋР С“Р РЋРІР‚С™Р В РЎвЂўР В РЎвЂР В РЎВР В РЎвЂўР РЋР С“Р РЋРІР‚С™Р В РЎвЂ, allocation drift, concentration risk Р В РЎвЂ explainability Р В РЎвЂ”Р В РЎвЂў valuation quality."
      >
        <PortfolioAnalyticsPanel analytics={portfolio.analytics} currency={portfolio.baseCurrency} />
      </SectionCard>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          eyebrow="Positions"
          title="Р В РЎСџР В РЎвЂўР В Р’В·Р В РЎвЂР РЋРІР‚В Р В РЎвЂР В РЎвЂ Р В РЎвЂ”Р В РЎвЂўР РЋР вЂљР РЋРІР‚С™Р РЋРІР‚С›Р В Р’ВµР В Р’В»Р РЋР РЏ"
          description="Р В РЎС›Р В Р’ВµР В РЎвЂќР РЋРЎвЂњР РЋРІР‚В°Р В РЎвЂР В РІвЂћвЂ“ Р РЋР С“Р РЋР вЂљР В Р’ВµР В Р’В· holdings Р В РЎвЂ”Р В РЎвЂў Р В Р’В±Р В Р’В°Р В Р’В·Р В Р’Вµ PostgreSQL."
        >
          <ManualAssetManager
            portfolioId={portfolio.id}
            baseCurrency={portfolio.baseCurrency}
            canManage={portfolio.canManage}
            positions={portfolio.positions}
            limitSnapshot={portfolio.limits}
          />
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            eyebrow="Telegram Gifts"
            title="OTC pricing workflow"
            description="Р В Р’В Р РЋРЎвЂњР РЋРІР‚РЋР В Р вЂ¦Р В РЎвЂўР В Р’Вµ Р В РЎвЂўР В Р’В±Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В Р’В»Р В Р’ВµР В Р вЂ¦Р В РЎвЂР В Р’Вµ Р РЋРІР‚В Р В Р’ВµР В Р вЂ¦, confidence, outlier detection Р В РЎвЂ Р В РЎвЂР РЋР С“Р РЋРІР‚С™Р В РЎвЂўР РЋР вЂљР В РЎвЂР РЋР РЏ price updates Р В РўвЂР В Р’В»Р РЋР РЏ Telegram Gifts."
          >
            <TelegramGiftPricingPanel
              portfolioId={portfolio.id}
              baseCurrency={portfolio.baseCurrency}
              canManage={portfolio.canManage}
              telegramPricing={portfolio.telegramPricing}
            />
          </SectionCard>

          {portfolio.canManage ? (
            <SectionCard
              eyebrow="Sharing"
              title="Shareable read-only links"
              description="Р РЋР С•Р В·Р Т‘Р В°Р Р…Р С‘Р Вµ Р С‘ Р С•РЎвЂљР В·РЎвЂ№Р Р† Р Р†Р Р…Р ВµРЎв‚¬Р Р…Р С‘РЎвЂ¦ view-only РЎРѓРЎРѓРЎвЂ№Р В»Р С•Р С” РЎРѓ scope controls, РЎРѓРЎР‚Р С•Р С”Р С•Р С Р В¶Р С‘Р В·Р Р…Р С‘ Р С‘ optional password."
            >
              <PortfolioShareLinksPanel portfolioId={portfolio.id} shareLinks={shareLinks} />
            </SectionCard>
          ) : null}

          <SectionCard
            eyebrow="Integrations"
            title="Р В РЎСџР В РЎвЂўР В РўвЂР В РЎвЂќР В Р’В»Р РЋР вЂ№Р РЋРІР‚РЋР В Р’ВµР В Р вЂ¦Р В РЎвЂР РЋР РЏ Р В РЎвЂ sync-layer"
            description="Р В РЎС›Р В Р’ВµР В РЎвЂќР РЋРЎвЂњР РЋРІР‚В°Р В Р’ВµР В Р’Вµ Р РЋР С“Р В РЎвЂўР РЋР С“Р РЋРІР‚С™Р В РЎвЂўР РЋР РЏР В Р вЂ¦Р В РЎвЂР В Р’Вµ Р В РЎвЂР В Р вЂ¦Р РЋРІР‚С™Р В Р’ВµР В РЎвЂ“Р РЋР вЂљР В Р’В°Р РЋРІР‚В Р В РЎвЂР В РІвЂћвЂ“ Р РЋР РЉР РЋРІР‚С™Р В РЎвЂўР В РЎвЂ“Р В РЎвЂў Р В РЎвЂ”Р В РЎвЂўР РЋР вЂљР РЋРІР‚С™Р РЋРІР‚С›Р В Р’ВµР В Р’В»Р РЋР РЏ."
          >
            {portfolio.integrationSummary.length === 0 ? (
              <DashboardStatePanel
                eyebrow="Р В Р’ВР В Р вЂ¦Р РЋРІР‚С™Р В Р’ВµР В РЎвЂ“Р РЋР вЂљР В Р’В°Р РЋРІР‚В Р В РЎвЂР В РЎвЂ Р В Р вЂ¦Р В Р’Вµ Р В РЎвЂ”Р В РЎвЂўР В РўвЂР В РЎвЂќР В Р’В»Р РЋР вЂ№Р РЋРІР‚РЋР В Р’ВµР В Р вЂ¦Р РЋРІР‚в„–"
                title="Р В РІР‚вЂќР В РўвЂР В Р’ВµР РЋР С“Р РЋР Р‰ Р В РЎвЂ”Р В РЎвЂўР В РЎвЂќР В Р’В° Р В РЎвЂ”Р РЋРЎвЂњР РЋР С“Р РЋРІР‚С™Р В РЎвЂў"
                description="Import center Р В РЎвЂ unified integrations flow Р В Р’В±Р РЋРЎвЂњР В РўвЂР РЋРЎвЂњР РЋРІР‚С™ Р В РўвЂР В РЎвЂўР В Р’В±Р В Р’В°Р В Р вЂ Р В Р’В»Р В Р’ВµР В Р вЂ¦Р РЋРІР‚в„– Р В Р вЂ¦Р В Р’В° Р РЋР С“Р В Р’В»Р В Р’ВµР В РўвЂР РЋРЎвЂњР РЋР вЂ№Р РЋРІР‚В°Р В РЎвЂР РЋРІР‚В¦ Р РЋР РЉР РЋРІР‚С™Р В Р’В°Р В РЎвЂ”Р В Р’В°Р РЋРІР‚В¦ roadmap."
                className="min-h-[220px]"
              />
            ) : (
              <div className="space-y-3">
                {portfolio.integrationSummary.map((integration) => (
                  <div
                    key={integration.id}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                  >
                    <p className="text-sm font-medium text-white">{integration.name}</p>
                    <p className="mt-2 text-sm text-slate-400">
                      {integration.type} Р вЂ™Р’В· {integration.mode} Р вЂ™Р’В· {integration.status}
                    </p>
                    <p className="mt-2 text-sm text-slate-300/75">
                      {integration.lastSyncedAt
                        ? `Р В РЎСџР В РЎвЂўР РЋР С“Р В Р’В»Р В Р’ВµР В РўвЂР В Р вЂ¦Р В РЎвЂР В РІвЂћвЂ“ sync ${formatRelativeTime(integration.lastSyncedAt)}`
                        : "Sync Р В Р’ВµР РЋРІР‚В°Р В Р’Вµ Р В Р вЂ¦Р В Р’Вµ Р В Р вЂ Р РЋРІР‚в„–Р В РЎвЂ”Р В РЎвЂўР В Р’В»Р В Р вЂ¦Р РЋР РЏР В Р’В»Р РЋР С“Р РЋР РЏ"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            eyebrow="Portfolio settings"
            title="Р В РЎСџР В Р’В°Р РЋР вЂљР В Р’В°Р В РЎВР В Р’ВµР РЋРІР‚С™Р РЋР вЂљР РЋРІР‚в„– Р В РЎвЂ”Р В РЎвЂўР РЋР вЂљР РЋРІР‚С™Р РЋРІР‚С›Р В Р’ВµР В Р’В»Р РЋР РЏ"
            description="Р В РІР‚ВР В Р’В°Р В Р’В·Р В РЎвЂўР В Р вЂ Р РЋРІР‚в„–Р В Р’Вµ Р В РЎВР В Р’ВµР РЋРІР‚С™Р В Р’В°Р В РўвЂР В Р’В°Р В Р вЂ¦Р В Р вЂ¦Р РЋРІР‚в„–Р В Р’Вµ Р В РЎвЂ tenant binding Р РЋРІР‚С™Р В Р’ВµР В РЎвЂќР РЋРЎвЂњР РЋРІР‚В°Р В Р’ВµР В РЎвЂ“Р В РЎвЂў Р В РЎвЂўР В Р’В±Р РЋР вЂ°Р В Р’ВµР В РЎвЂќР РЋРІР‚С™Р В Р’В°."
          >
            <dl className="space-y-3 text-sm text-slate-300/80">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <dt className="text-slate-400">Workspace</dt>
                <dd className="mt-2 text-white">
                  {portfolio.workspaceName} Р вЂ™Р’В· {portfolio.workspaceSlug}
                </dd>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <dt className="text-slate-400">Visibility</dt>
                <dd className="mt-2 text-white">{VISIBILITY_LABELS[portfolio.visibility]}</dd>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <dt className="text-slate-400">Risk profile</dt>
                <dd className="mt-2 text-white">{portfolio.riskProfile ?? "balanced"}</dd>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <dt className="text-slate-400">Base currency</dt>
                <dd className="mt-2 text-white">{portfolio.baseCurrency}</dd>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <dt className="text-slate-400">Р В РЎвЂєР В Р’В±Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В Р’В»Р В Р’ВµР В Р вЂ¦Р В РЎвЂў</dt>
                <dd className="mt-2 text-white">{formatRelativeTime(portfolio.updatedAt)}</dd>
              </div>
            </dl>
          </SectionCard>
        </div>
      </section>

      <SectionCard
        eyebrow="Recent activity"
        title="Р В РЎСџР В РЎвЂўР РЋР С“Р В Р’В»Р В Р’ВµР В РўвЂР В Р вЂ¦Р В РЎвЂР В Р’Вµ Р РЋРІР‚С™Р РЋР вЂљР В Р’В°Р В Р вЂ¦Р В Р’В·Р В Р’В°Р В РЎвЂќР РЋРІР‚В Р В РЎвЂР В РЎвЂ"
        description="Р В РЎСџР В РЎвЂўР РЋР С“Р В Р’В»Р В Р’ВµР В РўвЂР В Р вЂ¦Р В РЎвЂР В Р’Вµ Р РЋР С“Р В РЎвЂўР В Р’В±Р РЋРІР‚в„–Р РЋРІР‚С™Р В РЎвЂР РЋР РЏ portfolio event stream Р В Р вЂ  Р В Р’В±Р В Р’В°Р В Р’В·Р В Р’Вµ."
      >
        {portfolio.recentTransactions.length === 0 ? (
          <DashboardStatePanel
            eyebrow="Р В РЎС›Р РЋР вЂљР В Р’В°Р В Р вЂ¦Р В Р’В·Р В Р’В°Р В РЎвЂќР РЋРІР‚В Р В РЎвЂР В РІвЂћвЂ“ Р В Р вЂ¦Р В Р’ВµР РЋРІР‚С™"
            title="Р В Р’ВР РЋР С“Р РЋРІР‚С™Р В РЎвЂўР РЋР вЂљР В РЎвЂР РЋР РЏ Р В Р’ВµР РЋРІР‚В°Р В Р’Вµ Р В Р вЂ¦Р В Р’Вµ Р РЋР С“Р РЋРІР‚С›Р В РЎвЂўР РЋР вЂљР В РЎВР В РЎвЂР РЋР вЂљР В РЎвЂўР В Р вЂ Р В Р’В°Р В Р вЂ¦Р В Р’В°"
            description="Р В РЎСљР В Р’В° Р РЋР С“Р В Р’В»Р В Р’ВµР В РўвЂР РЋРЎвЂњР РЋР вЂ№Р РЋРІР‚В°Р В РЎвЂР РЋРІР‚В¦ Р РЋР РЉР РЋРІР‚С™Р В Р’В°Р В РЎвЂ”Р В Р’В°Р РЋРІР‚В¦ Р РЋР С“Р РЋР вЂ№Р В РўвЂР В Р’В° Р В Р’В±Р РЋРЎвЂњР В РўвЂР РЋРЎвЂњР РЋРІР‚С™ Р РЋР С“Р РЋРІР‚С™Р В Р’ВµР В РЎвЂќР В Р’В°Р РЋРІР‚С™Р РЋР Р‰Р РЋР С“Р РЋР РЏ Р В РЎвЂР В РЎВР В РЎвЂ”Р В РЎвЂўР РЋР вЂљР РЋРІР‚С™Р В РЎвЂР РЋР вЂљР В РЎвЂўР В Р вЂ Р В Р’В°Р В Р вЂ¦Р В Р вЂ¦Р РЋРІР‚в„–Р В Р’Вµ Р РЋР С“Р В РўвЂР В Р’ВµР В Р’В»Р В РЎвЂќР В РЎвЂ, Р РЋР вЂљР РЋРЎвЂњР РЋРІР‚РЋР В Р вЂ¦Р РЋРІР‚в„–Р В Р’Вµ Р В РЎвЂўР В РЎвЂ”Р В Р’ВµР РЋР вЂљР В Р’В°Р РЋРІР‚В Р В РЎвЂР В РЎвЂ Р В РЎвЂ pricing events."
            className="min-h-[220px]"
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {portfolio.recentTransactions.map((transaction) => (
              <article
                key={transaction.id}
                className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-base font-semibold text-white">
                      {transaction.assetName}
                    </p>
                    <p className="mt-2 text-sm text-slate-400">
                      {formatTransactionActionLabel(transaction.action)} Р вЂ™Р’В· {formatCategoryLabel(transaction.category)}
                    </p>
                  </div>
                  <p className="text-sm text-slate-300/80">
                    {formatRelativeTime(transaction.occurredAt)}
                  </p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Qty</p>
                    <p className="mt-2 text-sm text-white">
                      {transaction.quantity !== null ? formatNumber(transaction.quantity, 6) : "Р Р†Р вЂљРІР‚Сњ"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Price</p>
                    <p className="mt-2 text-sm text-white">
                      {transaction.unitPrice !== null && transaction.currency
                        ? formatCurrency(transaction.unitPrice, transaction.currency, 2)
                        : "Р Р†Р вЂљРІР‚Сњ"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Fees</p>
                    <p className="mt-2 text-sm text-white">
                      {transaction.fees !== null && transaction.currency
                        ? formatCurrency(transaction.fees, transaction.currency, 2)
                        : "Р Р†Р вЂљРІР‚Сњ"}
                    </p>
                  </div>
                </div>
                {transaction.notes ? (
                  <p className="mt-4 text-sm leading-7 text-slate-300/78">{transaction.notes}</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </main>
  );
}

