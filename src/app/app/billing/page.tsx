import type { Metadata } from "next";

import { BillingCenter } from "@/components/app/billing-center";
import { CreateWorkspaceForm } from "@/components/app/create-workspace-form";
import { DashboardStatePanel } from "@/components/dashboard/dashboard-state-panel";
import { getActiveWorkspaceSlug } from "@/lib/auth/active-workspace";
import { requireAppSession } from "@/lib/auth/session";
import { getCurrentUserWorkspaceContext } from "@/lib/auth/workspace";
import { getWorkspaceBillingSummaryForUser } from "@/lib/saas/billing";

export const metadata: Metadata = {
  title: "Billing",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function BillingPage() {
  const session = await requireAppSession();
  const activeWorkspaceSlug = await getActiveWorkspaceSlug();
  const context = await getCurrentUserWorkspaceContext(session.user.id, {
    preferredWorkspaceSlug: activeWorkspaceSlug ?? session.user.workspaceSlug ?? null,
  });
  const workspace = context?.primaryWorkspace;

  if (!workspace) {
    return (
      <main className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <DashboardStatePanel
          eyebrow="Billing недоступен"
          title="Нет активного workspace"
          description="Создайте новый workspace и затем вернитесь сюда, чтобы включить SaaS billing, планы и Stripe flows."
          className="min-h-[380px]"
        />
        <section className="panel rounded-[32px] border border-white/10 px-6 py-6 sm:px-8">
          <h2 className="text-2xl font-semibold text-white">Создать workspace</h2>
          <div className="mt-6">
            <CreateWorkspaceForm />
          </div>
        </section>
      </main>
    );
  }

  const summary = await getWorkspaceBillingSummaryForUser(session.user.id, workspace.id);

  if (!summary) {
    return (
      <main>
        <DashboardStatePanel
          eyebrow="Billing"
          title="Workspace не найден"
          description="Не удалось загрузить billing context для текущего пользователя."
          className="min-h-[380px]"
        />
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <section className="panel rounded-[32px] border border-white/10 px-6 py-6 sm:px-8">
        <p className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">Monetization</p>
        <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Billing & plans</h2>
        <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-300/80 sm:text-base">
          Stripe-powered billing surface для hosted SaaS mode: plan catalog, feature envelopes, Checkout, Customer Portal и webhook-driven sync статуса подписки обратно в PostgreSQL.
        </p>
      </section>

      <BillingCenter summary={summary} />
    </main>
  );
}