import Link from "next/link";

import { requireAppSession } from "@/lib/auth/session";
import { getCurrentUserWorkspaceContext, getWorkspacePortfolios } from "@/lib/auth/workspace";
import { formatRelativeTime } from "@/lib/utils";

export default async function PortfoliosPage() {
  const session = await requireAppSession();
  const context = await getCurrentUserWorkspaceContext(session.user.id);
  const workspace = context?.primaryWorkspace;
  const portfolios = workspace ? await getWorkspacePortfolios(workspace.id) : [];

  return (
    <main className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
      <section className="panel rounded-[32px] border border-white/10 px-6 py-6 sm:px-8">
        <p className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">Workspace inventory</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">Портфели workspace</h2>
        <p className="mt-4 text-sm leading-7 text-slate-300/80">
          Здесь уже работает protected SaaS-surface. На следующем этапе сюда ляжет
          полноценный portfolio management UI поверх PostgreSQL.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Всего портфелей</p>
            <p className="mt-3 text-3xl font-semibold text-white">{portfolios.length}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Slug workspace</p>
            <p className="mt-3 text-lg font-medium text-white">{workspace?.slug ?? "—"}</p>
          </div>
        </div>
      </section>

      <section className="panel rounded-[32px] border border-white/10 px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-2 pb-4">
          <h3 className="text-lg font-semibold text-white">Список портфелей</h3>
          <Link href="/app" className="text-sm text-cyan-200 transition hover:text-cyan-100">
            Вернуться к overview
          </Link>
        </div>
        <div className="mt-4 space-y-4">
          {portfolios.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 px-5 py-10 text-center text-sm text-slate-400">
              В этом workspace пока нет портфелей.
            </div>
          ) : (
            portfolios.map((portfolio) => (
              <article
                key={portfolio.id}
                className="rounded-3xl border border-white/10 bg-white/5 px-5 py-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-white">{portfolio.name}</p>
                    <p className="mt-2 text-sm text-slate-400">
                      slug: {portfolio.slug} · visibility: {portfolio.visibility.toLowerCase()}
                    </p>
                  </div>
                  <div className="text-sm text-slate-300/80">
                    <p>Позиций: {portfolio._count.positions}</p>
                    <p>Транзакций: {portfolio._count.transactions}</p>
                    <p>Обновлен {formatRelativeTime(portfolio.updatedAt)}</p>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
