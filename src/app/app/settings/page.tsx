import type { Metadata } from "next";

import { CreateWorkspaceForm } from "@/components/app/create-workspace-form";
import { DashboardStatePanel } from "@/components/dashboard/dashboard-state-panel";
import { getActiveWorkspaceSlug } from "@/lib/auth/active-workspace";
import { requireAppSession } from "@/lib/auth/session";
import { getCurrentUserWorkspaceContext } from "@/lib/auth/workspace";
import { formatRelativeTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Настройки SaaS",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AppSettingsPage() {
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
          eyebrow="Настройки недоступны"
          title="Нет активного workspace"
          description="Создайте новый workspace и затем вернитесь сюда для просмотра tenant-настроек, ролей и SaaS-метаданных."
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

  return (
    <main className="grid gap-6 lg:grid-cols-2">
      <section className="panel rounded-[32px] border border-white/10 px-6 py-6 sm:px-8">
        <p className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">Account</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">Настройки аккаунта</h2>
        <dl className="mt-8 space-y-4 text-sm text-slate-300/80">
          <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
            <dt className="text-slate-400">Email</dt>
            <dd className="mt-2 text-white">{context?.user.email ?? session.user.email ?? "—"}</dd>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
            <dt className="text-slate-400">Часовой пояс</dt>
            <dd className="mt-2 text-white">{context?.user.timezone ?? "UTC"}</dd>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
            <dt className="text-slate-400">Последний вход</dt>
            <dd className="mt-2 text-white">
              {context?.user.lastLoginAt ? formatRelativeTime(context.user.lastLoginAt) : "Первый вход"}
            </dd>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
            <dt className="text-slate-400">Количество workspace</dt>
            <dd className="mt-2 text-white">{context?.memberships.length ?? 0}</dd>
          </div>
        </dl>
      </section>

      <section className="panel rounded-[32px] border border-white/10 px-6 py-6 sm:px-8">
        <p className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">Workspace</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">Настройки tenant</h2>
        <dl className="mt-8 space-y-4 text-sm text-slate-300/80">
          <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
            <dt className="text-slate-400">Название</dt>
            <dd className="mt-2 text-white">{workspace.name}</dd>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
            <dt className="text-slate-400">Slug</dt>
            <dd className="mt-2 text-white">{workspace.slug}</dd>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
            <dt className="text-slate-400">Роль</dt>
            <dd className="mt-2 text-white">{workspace.role}</dd>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
            <dt className="text-slate-400">Default currency</dt>
            <dd className="mt-2 text-white">{workspace.defaultCurrency}</dd>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
            <dt className="text-slate-400">Timezone</dt>
            <dd className="mt-2 text-white">{workspace.timezone}</dd>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
            <dt className="text-slate-400">Состав</dt>
            <dd className="mt-2 text-white">
              {workspace.memberCount} участников · {workspace.portfolioCount} портфелей · {workspace.integrationCount} интеграций
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
