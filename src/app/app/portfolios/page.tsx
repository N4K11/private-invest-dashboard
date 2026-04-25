import type { Metadata } from "next";

import Link from "next/link";

import { PortfolioManagementPanel } from "@/components/app/portfolio-management-panel";
import { DashboardStatePanel } from "@/components/dashboard/dashboard-state-panel";
import { getActiveWorkspaceSlug } from "@/lib/auth/active-workspace";
import { requireAppSession } from "@/lib/auth/session";
import { getCurrentUserWorkspaceContext } from "@/lib/auth/workspace";
import { listPortfoliosForWorkspace } from "@/lib/saas/portfolios";
import { getWorkspaceLimitSnapshotForUser } from "@/lib/saas/limits";

export const metadata: Metadata = {
  title: "Портфели SaaS",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PortfoliosPage() {
  const session = await requireAppSession();
  const activeWorkspaceSlug = await getActiveWorkspaceSlug();
  const context = await getCurrentUserWorkspaceContext(session.user.id, {
    preferredWorkspaceSlug: activeWorkspaceSlug ?? session.user.workspaceSlug ?? null,
  });
  const workspace = context?.primaryWorkspace;

  if (!workspace) {
    return (
      <DashboardStatePanel
        eyebrow="Нет workspace"
        title="Нельзя открыть портфели без активного workspace"
        description="Сначала выберите или создайте workspace на главной SaaS-странице."
        action={<Link href="/app" className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">Вернуться в SaaS home</Link>}
      />
    );
  }

  const [portfolios, limitSnapshot] = await Promise.all([
    listPortfoliosForWorkspace(session.user.id, workspace.id),
    getWorkspaceLimitSnapshotForUser(session.user.id, workspace.id),
  ]);

  return (
    <main className="space-y-6">
      <section className="panel rounded-[32px] border border-white/10 px-6 py-6 sm:px-8">
        <p className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">Workspace portfolios</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-3xl font-semibold text-white">Портфели workspace</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300/80">
              Здесь собран основной management UI: создание, редактирование, архивирование и переход в detail page каждого портфеля. Feature gates по тарифу применяются здесь же.
            </p>
          </div>
          <Link href="/app" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-white/20 hover:text-white">Вернуться в overview</Link>
        </div>
      </section>

      <PortfolioManagementPanel
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        defaultCurrency={workspace.defaultCurrency}
        canManage={workspace.role === "owner" || workspace.role === "admin"}
        portfolios={portfolios}
        limitSnapshot={limitSnapshot}
      />
    </main>
  );
}