import type { Metadata } from "next";

import { CreateWorkspaceForm } from "@/components/app/create-workspace-form";
import { AlertsCenter } from "@/components/app/alerts-center";
import { DashboardStatePanel } from "@/components/dashboard/dashboard-state-panel";
import { getActiveWorkspaceSlug } from "@/lib/auth/active-workspace";
import { requireAppSession } from "@/lib/auth/session";
import { getCurrentUserWorkspaceContext } from "@/lib/auth/workspace";
import { getAlertsWorkspaceViewForUser } from "@/lib/saas/alerts";

export const metadata: Metadata = {
  title: "Alerts center",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AlertsPage() {
  const session = await requireAppSession();
  const activeWorkspaceSlug = await getActiveWorkspaceSlug();
  const context = await getCurrentUserWorkspaceContext(session.user.id, {
    preferredWorkspaceSlug: activeWorkspaceSlug ?? session.user.workspaceSlug ?? null,
  });
  const workspace = context?.primaryWorkspace;

  if (!workspace) {
    return (
      <main className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <DashboardStatePanel eyebrow="Alerts недоступны" title="Нет активного workspace" description="Создайте новый workspace и затем вернитесь сюда, чтобы настроить сигналы и уведомления." className="min-h-[380px]" />
        <section className="panel rounded-[32px] border border-white/10 px-6 py-6 sm:px-8">
          <h2 className="text-2xl font-semibold text-white">Создать workspace</h2>
          <div className="mt-6"><CreateWorkspaceForm /></div>
        </section>
      </main>
    );
  }

  const view = await getAlertsWorkspaceViewForUser(session.user.id, workspace.id);

  if (!view) {
    return (
      <main>
        <DashboardStatePanel eyebrow="Alerts" title="Workspace не найден" description="Не удалось загрузить alerts context для текущего пользователя." className="min-h-[380px]" />
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <section className="panel rounded-[32px] border border-white/10 px-6 py-6 sm:px-8">
        <p className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">Notifications</p>
        <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Alerts & notifications</h2>
        <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-300/80 sm:text-base">
          Слой алертов поверх SaaS valuation и analytics: price above/below, portfolio value change, stale price и concentration risk с email delivery abstraction и историей событий.
        </p>
      </section>

      <AlertsCenter
        workspaceId={view.workspaceId}
        workspaceName={view.workspaceName}
        defaultCurrency={view.defaultCurrency}
        defaultRecipientEmail={view.defaultRecipientEmail}
        canManage={view.canManage}
        portfolios={view.portfolios}
        assets={view.assets}
        rules={view.rules}
        events={view.events}
        limitSnapshot={view.limits}
      />
    </main>
  );
}