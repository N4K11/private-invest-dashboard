import type { Metadata } from "next";

import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { SharedAllocationBreakdown } from "@/components/app/shared-allocation-breakdown";
import { SharedPortfolioUnlock } from "@/components/app/shared-portfolio-unlock";
import { DashboardStatePanel } from "@/components/dashboard/dashboard-state-panel";
import { SectionCard } from "@/components/dashboard/section-card";
import { SummaryCard } from "@/components/dashboard/summary-card";
import {
  getShareAccessCookieName,
  resolveSharedPortfolioViewByToken,
} from "@/lib/saas/sharing";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Shared portfolio view",
  robots: {
    index: false,
    follow: false,
  },
};

type PageProps = {
  params: Promise<{
    shareToken: string;
  }>;
};

export default async function SharedPortfolioPage({ params }: PageProps) {
  const { shareToken } = await params;
  const cookieStore = await cookies();
  const result = await resolveSharedPortfolioViewByToken(
    shareToken,
    cookieStore.get(getShareAccessCookieName(shareToken))?.value,
  );

  if (result.status === "not_found") {
    notFound();
  }

  if (result.status === "revoked") {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <DashboardStatePanel
          eyebrow="Share link revoked"
          title={result.shareLabel ?? "Доступ отозван"}
          description="Владелец этого портфеля отозвал ссылку. Старый URL больше не открывает read-only dashboard."
          tone="error"
          className="min-h-[320px]"
        />
      </main>
    );
  }

  if (result.status === "expired") {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <DashboardStatePanel
          eyebrow="Share link expired"
          title={result.shareLabel ?? "Срок ссылки истёк"}
          description="Ссылка была создана с ограниченным сроком жизни и больше не показывает shared dashboard."
          tone="warning"
          className="min-h-[320px]"
        />
      </main>
    );
  }

  if (result.status === "password_required") {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <SharedPortfolioUnlock
          shareToken={shareToken}
          shareLabel={result.shareLabel}
          expiresAt={result.expiresAt}
        />
      </main>
    );
  }

  const { view } = result;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <section className="panel rounded-[32px] border border-white/10 px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">
              Shared portfolio view
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
              {view.shareLabel ?? view.portfolioName}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-300/80 sm:text-base">
              Read-only dashboard для внешнего просмотра. Эта страница не использует private API routes и не содержит write-действий.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs uppercase tracking-[0.2em] text-slate-300/80">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{view.workspaceName}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{view.baseCurrency}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">values {view.valueVisibility}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">qty {view.quantityVisibility}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">pnl {view.pnlVisibility}</span>
              {view.scope.allocationOnly ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">allocation only</span>
              ) : null}
            </div>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-white/[0.03] px-5 py-4 text-sm leading-7 text-slate-300/78">
            <p className="font-medium text-white">Последнее обновление</p>
            <p className="mt-2">{formatRelativeTime(view.updatedAt)}</p>
            <p className="mt-4 font-medium text-white">Срок действия ссылки</p>
            <p className="mt-2">{view.expiresAt ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(view.expiresAt)) : "Без срока"}</p>
          </div>
        </div>
      </section>

      {!view.scope.allocationOnly ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {view.summaryCards.map((card) => (
            <SummaryCard key={card.id} card={card} currency={view.baseCurrency} />
          ))}
        </section>
      ) : null}

      <SectionCard
        eyebrow="Allocation"
        title="Структура портфеля"
        description="Распределение текущей структуры по категориям. Проценты считаются на сервере, но числовые значения могут быть скрыты scope-настройками."
      >
        <SharedAllocationBreakdown allocation={view.allocation} baseCurrency={view.baseCurrency} />
      </SectionCard>

      {view.scope.allocationOnly ? (
        <DashboardStatePanel
          eyebrow="Allocation only"
          title="Детали позиций скрыты владельцем"
          description="Для этой shared-ссылки включен режим только allocation, поэтому список активов и детальные значения не отображаются."
          className="min-h-[220px]"
        />
      ) : (
        <SectionCard
          eyebrow="Holdings"
          title="Позиции"
          description="Состав текущих holdings с применёнными scope-ограничениями."
        >
          <div className="grid gap-3">
            {view.positions.map((position) => (
              <article key={position.id} className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <p className="text-base font-semibold text-white">{position.assetName}</p>
                    <p className="mt-2 text-sm text-slate-400">
                      {position.category.toUpperCase()}
                      {position.symbol ? ` · ${position.symbol}` : ""}
                    </p>
                    {position.priceWarning ? (
                      <p className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
                        {position.priceWarning}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[420px] xl:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Qty</p>
                      <p className="mt-2 text-sm text-white">{position.quantity === null ? "Скрыто" : position.quantity.toLocaleString("ru-RU")}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Price</p>
                      <p className="mt-2 text-sm text-white">{position.currentPrice === null ? "Скрыто" : formatCurrency(position.currentPrice, view.baseCurrency, 2)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Value</p>
                      <p className="mt-2 text-sm text-white">{position.totalValue === null ? "Скрыто" : formatCurrency(position.totalValue, view.baseCurrency, 2)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">PnL</p>
                      <p className="mt-2 text-sm text-white">{position.pnl === null ? "Скрыто" : formatCurrency(position.pnl, view.baseCurrency, 2)}</p>
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-sm text-slate-400">
                  {position.priceSource ? `Источник цены: ${position.priceSource}` : "Источник цены не указан"}
                  {position.priceUpdatedAt ? ` · обновлено ${formatRelativeTime(position.priceUpdatedAt)}` : ""}
                </p>
              </article>
            ))}
          </div>
        </SectionCard>
      )}
    </main>
  );
}