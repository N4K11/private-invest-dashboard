import { requireAppSession } from "@/lib/auth/session";
import { getCurrentUserWorkspaceContext } from "@/lib/auth/workspace";
import { formatRelativeTime } from "@/lib/utils";

export default async function AppSettingsPage() {
  const session = await requireAppSession();
  const context = await getCurrentUserWorkspaceContext(session.user.id);
  const workspace = context?.primaryWorkspace;

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
        </dl>
      </section>

      <section className="panel rounded-[32px] border border-white/10 px-6 py-6 sm:px-8">
        <p className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">Workspace</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">Настройки workspace</h2>
        <dl className="mt-8 space-y-4 text-sm text-slate-300/80">
          <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
            <dt className="text-slate-400">Название</dt>
            <dd className="mt-2 text-white">{workspace?.name ?? "—"}</dd>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
            <dt className="text-slate-400">Slug</dt>
            <dd className="mt-2 text-white">{workspace?.slug ?? "—"}</dd>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
            <dt className="text-slate-400">Роль</dt>
            <dd className="mt-2 text-white">{workspace?.role ?? "viewer"}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
