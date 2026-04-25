import type { Metadata } from "next";

import { CreateWorkspaceForm } from "@/components/app/create-workspace-form";
import { PortfolioManagementPanel } from "@/components/app/portfolio-management-panel";
import { DashboardStatePanel } from "@/components/dashboard/dashboard-state-panel";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { getActiveWorkspaceSlug } from "@/lib/auth/active-workspace";
import { requireAppSession } from "@/lib/auth/session";
import { getCurrentUserWorkspaceContext } from "@/lib/auth/workspace";
import { listPortfoliosForWorkspace } from "@/lib/saas/portfolios";
import { getWorkspaceOverview } from "@/lib/saas/workspaces";
import { formatRelativeTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "SaaS обзор",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SaasHomePage() {
  const session = await requireAppSession();
  const activeWorkspaceSlug = await getActiveWorkspaceSlug();
  const context = await getCurrentUserWorkspaceContext(session.user.id, {
    preferredWorkspaceSlug: activeWorkspaceSlug ?? session.user.workspaceSlug ?? null,
  });
  const activeWorkspace = context?.primaryWorkspace;

  if (!activeWorkspace) {
    return (
      <main className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <DashboardStatePanel
          eyebrow="Workspace не найден"
          title="У пользователя еще нет активного workspace"
          description="Создайте первый workspace, чтобы включить SaaS контур: портфели, импорты, аналитику и будущие интеграции."
          className="min-h-[420px]"
        />
        <section className="panel rounded-[32px] border border-white/10 px-6 py-6 sm:px-8">
          <p className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">Bootstrap</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">Создание первого workspace</h2>
          <p className="mt-4 text-sm leading-7 text-slate-300/80">
            После создания новый workspace станет активным, а внутри автоматически появится главный портфель.
          </p>
          <div className="mt-8">
            <CreateWorkspaceForm />
          </div>
        </section>
      </main>
    );
  }

  const [overview, portfolios] = await Promise.all([
    getWorkspaceOverview(activeWorkspace.id),
    listPortfoliosForWorkspace(session.user.id, activeWorkspace.id),
  ]);

  const cards = overview
    ? [
        {
          id: "aum",
          label: "AUM",
          value: overview.totalValue,
          hint: "Суммарная оценка всех портфелей внутри активного workspace.",
          format: "currency" as const,
          tone: "neutral" as const,
        },
        {
          id: "portfolios",
          label: "Портфели",
          value: overview.portfolioCount,
          hint: "Количество активных портфелей в текущем workspace.",
          format: "compact" as const,
          tone: "neutral" as const,
        },
        {
          id: "members",
          label: "Участники",
          value: overview.memberCount,
          hint: "Текущий размер команды и будущий SaaS tenancy scope.",
          format: "compact" as const,
          tone: "neutral" as const,
        },
        {
          id: "pnl",
          label: "Суммарный PnL",
          value: overview.totalPnl,
          hint: "Разница между рыночной оценкой и общей себестоимостью.",
          format: "currency" as const,
          tone:
            overview.totalPnl > 0
              ? ("positive" as const)
              : overview.totalPnl < 0
                ? ("negative" as const)
                : ("neutral" as const),
        },
      ]
    : [];

  return (
    <main className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel rounded-[32px] border border-white/10 px-6 py-6 sm:px-8">
          <p className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">SaaS home</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Управление workspace и портфелями из одной панели.
          </h2>
          <p className="mt-5 max-w-2xl text-sm leading-8 text-slate-300/80 sm:text-base">
            Активный workspace определяет контекст `/app`: какие портфели вы видите, какие настройки редактируете и куда дальше будет подключаться import center.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Активный workspace</p>
              <p className="mt-3 text-lg font-medium text-white">{activeWorkspace.name}</p>
              <p className="mt-2 text-sm text-slate-400">slug: {activeWorkspace.slug}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Последняя активность</p>
              <p className="mt-3 text-lg font-medium text-white">
                {overview?.lastActivityAt ? formatRelativeTime(overview.lastActivityAt) : "Нет событий"}
              </p>
              <p className="mt-2 text-sm text-slate-400">Роль: {activeWorkspace.role}</p>
            </div>
          </div>
        </div>

        <section className="panel rounded-[32px] border border-white/10 px-6 py-6 sm:px-8">
          <p className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">Новый workspace</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">Создать отдельный tenant</h3>
          <p className="mt-4 text-sm leading-7 text-slate-300/80">
            Используйте отдельные workspace для клиентов, личных стратегий или разных юридических контуров. Новый workspace сразу получит owner-доступ и bootstrap portfolio.
          </p>
          <div className="mt-8">
            <CreateWorkspaceForm />
          </div>
        </section>
      </section>

      {overview ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <SummaryCard key={card.id} card={card} currency={activeWorkspace.defaultCurrency} />
          ))}
        </section>
      ) : null}

      <PortfolioManagementPanel
        workspaceId={activeWorkspace.id}
        workspaceName={activeWorkspace.name}
        defaultCurrency={activeWorkspace.defaultCurrency}
        canManage={activeWorkspace.role === "owner" || activeWorkspace.role === "admin"}
        portfolios={portfolios}
      />
    </main>
  );
}
