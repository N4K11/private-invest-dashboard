import type { Metadata } from "next";

import Link from "next/link";
import { notFound } from "next/navigation";

import { ManualAssetManager } from "@/components/app/manual-asset-manager";
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
import { formatCurrency, formatNumber, formatRelativeTime } from "@/lib/utils";
import type { SaasAssetCategory, SaasPortfolioVisibility } from "@/types/saas";

const CATEGORY_LABELS: Record<SaasAssetCategory, string> = {
  cs2: "CS2",
  telegram: "Telegram Gifts",
  crypto: "Крипта",
  custom: "Custom",
  nft: "NFT",
};

const VISIBILITY_LABELS: Record<SaasPortfolioVisibility, string> = {
  private: "Private",
  shared_link: "Shared link",
  workspace: "Внутри workspace",
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
              Database-backed detail page для SaaS-портфеля. Здесь уже работают summary cards, allocation charts, таблица позиций, последние транзакции и отдельный OTC pricing workflow для Telegram Gifts.
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
              Ко всем портфелям
            </Link>
            <Link
              href="/app/settings"
              className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Настройки workspace
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
          title="Предупреждения по данным"
          description="Эти сигналы помогают понять, почему оценка портфеля может быть неполной или менее точной."
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

      <section className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          eyebrow="Allocation"
          title="Структура портфеля"
          description="Распределение текущей стоимости по категориям активов."
        >
          <AllocationChart data={portfolio.allocation} currency={portfolio.baseCurrency} />
        </SectionCard>

        <SectionCard
          eyebrow="Cost vs Value"
          title="Себестоимость против оценки"
          description="Помогает быстро увидеть, какая категория уже в плюсах, а какая еще только в наборе позиции."
        >
          <CategoryPerformanceChart
            data={portfolio.categoryPerformance}
            currency={portfolio.baseCurrency}
          />
        </SectionCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          eyebrow="Positions"
          title="Позиции портфеля"
          description="Текущий срез holdings по базе PostgreSQL."
        >
          <ManualAssetManager
            portfolioId={portfolio.id}
            baseCurrency={portfolio.baseCurrency}
            canManage={portfolio.canManage}
            positions={portfolio.positions}
          />
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            eyebrow="Telegram Gifts"
            title="OTC pricing workflow"
            description="Ручное обновление цен, confidence, outlier detection и история price updates для Telegram Gifts."
          >
            <TelegramGiftPricingPanel
              portfolioId={portfolio.id}
              baseCurrency={portfolio.baseCurrency}
              canManage={portfolio.canManage}
              telegramPricing={portfolio.telegramPricing}
            />
          </SectionCard>

          <SectionCard
            eyebrow="Integrations"
            title="Подключения и sync-layer"
            description="Текущее состояние интеграций этого портфеля."
          >
            {portfolio.integrationSummary.length === 0 ? (
              <DashboardStatePanel
                eyebrow="Интеграции не подключены"
                title="Здесь пока пусто"
                description="Import center и unified integrations flow будут добавлены на следующих этапах roadmap."
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
                      {integration.type} · {integration.mode} · {integration.status}
                    </p>
                    <p className="mt-2 text-sm text-slate-300/75">
                      {integration.lastSyncedAt
                        ? `Последний sync ${formatRelativeTime(integration.lastSyncedAt)}`
                        : "Sync еще не выполнялся"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            eyebrow="Portfolio settings"
            title="Параметры портфеля"
            description="Базовые метаданные и tenant binding текущего объекта."
          >
            <dl className="space-y-3 text-sm text-slate-300/80">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <dt className="text-slate-400">Workspace</dt>
                <dd className="mt-2 text-white">
                  {portfolio.workspaceName} · {portfolio.workspaceSlug}
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
                <dt className="text-slate-400">Обновлено</dt>
                <dd className="mt-2 text-white">{formatRelativeTime(portfolio.updatedAt)}</dd>
              </div>
            </dl>
          </SectionCard>
        </div>
      </section>

      <SectionCard
        eyebrow="Recent activity"
        title="Последние транзакции"
        description="Последние события portfolio event stream в базе."
      >
        {portfolio.recentTransactions.length === 0 ? (
          <DashboardStatePanel
            eyebrow="Транзакций нет"
            title="История еще не сформирована"
            description="На следующих этапах сюда будут стекаться импортированные сделки, ручные операции и pricing events."
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
                      {formatTransactionActionLabel(transaction.action)} · {formatCategoryLabel(transaction.category)}
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
                      {transaction.quantity !== null ? formatNumber(transaction.quantity, 6) : "—"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Price</p>
                    <p className="mt-2 text-sm text-white">
                      {transaction.unitPrice !== null && transaction.currency
                        ? formatCurrency(transaction.unitPrice, transaction.currency, 2)
                        : "—"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Fees</p>
                    <p className="mt-2 text-sm text-white">
                      {transaction.fees !== null && transaction.currency
                        ? formatCurrency(transaction.fees, transaction.currency, 2)
                        : "—"}
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
