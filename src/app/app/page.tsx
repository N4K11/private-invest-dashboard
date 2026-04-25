import Link from "next/link";

import { requireAppSession } from "@/lib/auth/session";
import { getCurrentUserWorkspaceContext } from "@/lib/auth/workspace";

export default async function SaasHomePage() {
  const session = await requireAppSession();
  const context = await getCurrentUserWorkspaceContext(session.user.id);
  const primaryWorkspace = context?.primaryWorkspace;

  return (
    <main className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="panel rounded-[32px] border border-white/10 px-6 py-6 sm:px-8">
        <p className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">Stage 15</p>
        <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
          SaaS auth и workspace binding уже активны.
        </h2>
        <p className="mt-5 max-w-2xl text-sm leading-8 text-slate-300/80 sm:text-base">
          Этот раздел использует полноценную session-based авторизацию через Auth.js.
          Legacy private dashboard на скрытом slug продолжает жить рядом и не зависит
          от PostgreSQL login-flow.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Пользователь</p>
            <p className="mt-3 text-lg font-medium text-white">
              {context?.user.displayName ?? session.user.email}
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Workspace</p>
            <p className="mt-3 text-lg font-medium text-white">{primaryWorkspace?.name ?? "—"}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Роль</p>
            <p className="mt-3 text-lg font-medium text-white">{primaryWorkspace?.role ?? "viewer"}</p>
          </div>
        </div>
      </section>

      <section className="panel rounded-[32px] border border-white/10 px-6 py-6 sm:px-8">
        <h3 className="text-xl font-semibold text-white">Что уже доступно</h3>
        <div className="mt-6 space-y-3 text-sm leading-7 text-slate-300/80">
          <p>1. Регистрация с bootstrap owner-workspace и базовым portfolio.</p>
          <p>2. Session auth для `/app`, `/app/portfolios`, `/app/settings`.</p>
          <p>3. Workspace roles: owner, admin, member, viewer.</p>
          <p>4. Legacy private route работает параллельно и не ломается.</p>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/app/portfolios"
            className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            Открыть портфели
          </Link>
          <Link
            href="/app/settings"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-white/20 hover:text-white"
          >
            Открыть настройки
          </Link>
        </div>
      </section>
    </main>
  );
}
