"use client";

import { useMemo, useState, useTransition } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { DashboardStatePanel } from "@/components/dashboard/dashboard-state-panel";
import { cn, formatNumber } from "@/lib/utils";
import type { SaasWorkspaceBillingSummary } from "@/types/saas";

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatPlanStatus(status: SaasWorkspaceBillingSummary["currentSubscription"]["status"]) {
  switch (status) {
    case "active":
      return "Active";
    case "trialing":
      return "Trialing";
    case "past_due":
      return "Past due";
    case "canceled":
      return "Canceled";
    default:
      return "Incomplete";
  }
}

function getStatusTone(status: SaasWorkspaceBillingSummary["currentSubscription"]["status"]) {
  switch (status) {
    case "active":
      return "border-emerald-400/22 bg-emerald-400/10 text-emerald-100";
    case "trialing":
      return "border-cyan-300/22 bg-cyan-300/10 text-cyan-100";
    case "past_due":
      return "border-amber-300/22 bg-amber-300/10 text-amber-100";
    case "canceled":
      return "border-slate-400/22 bg-slate-400/10 text-slate-200";
    default:
      return "border-rose-400/22 bg-rose-400/10 text-rose-100";
  }
}

function formatLimit(value: number | null, unit: string) {
  if (value === null) {
    return "Unlimited";
  }

  if (Number.isInteger(value)) {
    return `${formatNumber(value, 0)} ${unit}`;
  }

  return `${formatNumber(value, 1)} ${unit}`;
}

function buildFlashMessage(searchParams: URLSearchParams) {
  const checkoutState = searchParams.get("checkout");
  const portalState = searchParams.get("portal");

  if (checkoutState === "success") {
    return {
      tone: "success" as const,
      message: "Checkout завершен. Stripe webhook синхронизирует статус подписки после подтверждения оплаты.",
    };
  }

  if (checkoutState === "cancel") {
    return {
      tone: "warning" as const,
      message: "Checkout отменен. Тариф не изменен.",
    };
  }

  if (portalState === "returned") {
    return {
      tone: "neutral" as const,
      message: "Вы вернулись из Stripe Customer Portal. Обновите страницу, если только что изменили подписку.",
    };
  }

  return null;
}

export function BillingCenter({ summary }: { summary: SaasWorkspaceBillingSummary }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const flash = useMemo(() => buildFlashMessage(searchParams), [searchParams]);
  const [feedback, setFeedback] = useState<{ tone: "error" | "success" | "warning"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCheckout(plan: "pro" | "whale" | "team") {
    setFeedback(null);

    startTransition(async () => {
      const response = await fetch("/api/app/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: summary.workspaceId,
          plan,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; url?: string }
        | null;

      if (!response.ok || !payload?.url) {
        setFeedback({
          tone: "error",
          message: payload?.error ?? "Не удалось открыть Stripe Checkout.",
        });
        return;
      }

      window.location.href = payload.url;
    });
  }

  function handlePortal() {
    setFeedback(null);

    startTransition(async () => {
      const response = await fetch("/api/app/billing/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: summary.workspaceId,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; url?: string }
        | null;

      if (!response.ok || !payload?.url) {
        setFeedback({
          tone: "error",
          message: payload?.error ?? "Не удалось открыть Stripe Customer Portal.",
        });
        return;
      }

      window.location.href = payload.url;
    });
  }

  const activePlan = summary.currentSubscription.plan;

  return (
    <div className="space-y-6">
      {flash ? (
        <div
          className={cn(
            "rounded-[26px] border px-5 py-4 text-sm leading-7",
            flash.tone === "success"
              ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
              : flash.tone === "warning"
                ? "border-amber-300/25 bg-amber-300/10 text-amber-100"
                : "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
          )}
        >
          {flash.message}
        </div>
      ) : null}

      {feedback ? (
        <div
          className={cn(
            "rounded-[26px] border px-5 py-4 text-sm leading-7",
            feedback.tone === "success"
              ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
              : feedback.tone === "warning"
                ? "border-amber-300/25 bg-amber-300/10 text-amber-100"
                : "border-rose-400/25 bg-rose-400/10 text-rose-100",
          )}
        >
          {feedback.message}
        </div>
      ) : null}

      {summary.warnings.length > 0 ? (
        <div className="space-y-3">
          {summary.warnings.map((warning) => (
            <div
              key={warning}
              className="rounded-[24px] border border-amber-300/20 bg-amber-300/10 px-5 py-4 text-sm leading-7 text-amber-50/92"
            >
              {warning}
            </div>
          ))}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(7,16,31,0.96),rgba(13,43,65,0.86))] p-5 sm:p-6">
          <p className="text-[0.68rem] uppercase tracking-[0.32em] text-cyan-200/72">Stripe billing</p>
          <h3 className="mt-3 text-2xl font-semibold text-white sm:text-[1.8rem]">
            {summary.workspaceName} · {summary.plans.find((plan) => plan.plan === activePlan)?.label ?? activePlan}
          </h3>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200/82">
            Current plan controls plan catalog, feature envelopes и будущие hard limits для workspace. Stage 25 уже готовит Checkout, Customer Portal и webhook sync, а Stage 26 навесит жесткое применение лимитов на write-операции.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-[0.68rem] uppercase tracking-[0.22em] text-slate-200/82">
            <span className={cn("rounded-full border px-3 py-1", getStatusTone(summary.currentSubscription.status))}>
              {formatPlanStatus(summary.currentSubscription.status)}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Seats {summary.currentSubscription.seatCount}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Provider {summary.currentSubscription.billingProvider ?? "none"}
            </span>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-100">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Current period end</p>
              <p className="mt-2 text-base font-semibold text-white">{formatDate(summary.currentSubscription.currentPeriodEnd)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-100">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Trial ends</p>
              <p className="mt-2 text-base font-semibold text-white">{formatDate(summary.currentSubscription.trialEndsAt)}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handlePortal}
              disabled={isPending || !summary.canManage || !summary.customerPortalReady}
              className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Открываю..." : "Stripe Customer Portal"}
            </button>
            <button
              type="button"
              onClick={() => router.refresh()}
              disabled={isPending}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Обновить статус
            </button>
          </div>
        </div>

        <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <h3 className="text-xl font-semibold text-white">Usage vs plan limits</h3>
          <p className="mt-2 text-sm leading-7 text-slate-300/74">
            Здесь уже видны текущие usage counters и envelopes по тарифу. Жесткое применение этих лимитов к write-операциям будет закреплено на следующем этапе roadmap.
          </p>
          <div className="mt-5 space-y-3">
            {summary.usage.map((item) => (
              <div key={item.key} className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    <p className="mt-2 text-sm text-slate-400">
                      {item.used} used · {item.limit === null ? "unlimited" : `${item.limit} max`} · {item.remaining === null ? "∞" : `${item.remaining} left`}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300/84">
                    {item.unit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
        {summary.plans.map((plan) => {
          const isUpgradeTarget = activePlan !== plan.plan && plan.plan !== "free";

          return (
            <article
              key={plan.plan}
              className={cn(
                "rounded-[28px] border p-5 sm:p-6",
                plan.isCurrent
                  ? "border-cyan-300/30 bg-cyan-300/[0.08]"
                  : "border-white/10 bg-white/[0.03]",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/72">{plan.plan}</p>
                  <h3 className="mt-3 text-2xl font-semibold text-white">{plan.label}</h3>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-200/84">
                  {plan.monthlyPriceUsd === 0 ? "Free" : `$${plan.monthlyPriceUsd}/mo`}
                </span>
              </div>

              <p className="mt-4 text-sm leading-7 text-slate-300/78">{plan.description}</p>

              <div className="mt-5 grid gap-2 text-sm text-slate-200">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                  Портфели: {formatLimit(plan.limits.portfolios, "шт.")}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                  Позиции: {formatLimit(plan.limits.positions, "шт.")}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                  Интеграции: {formatLimit(plan.limits.integrations, "шт.")}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                  Alerts: {formatLimit(plan.limits.alerts, "шт.")}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                  Price refresh lane: {formatLimit(plan.limits.priceRefreshHours, "ч")}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                  History retention: {formatLimit(plan.limits.historyRetentionDays, "дней")}
                </div>
              </div>

              <div className="mt-5 space-y-2 text-sm leading-7 text-slate-300/82">
                {plan.highlights.map((highlight) => (
                  <p key={`${plan.plan}-${highlight}`}>{highlight}</p>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => isUpgradeTarget && handleCheckout(plan.plan as "pro" | "whale" | "team")}
                  disabled={isPending || !isUpgradeTarget || !plan.canCheckout}
                  className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {plan.isCurrent ? "Текущий план" : !plan.stripePriceConfigured ? "Price ID missing" : "Перейти на план"}
                </button>
                {plan.isCurrent ? (
                  <span className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                    Активен сейчас
                  </span>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>

      {!summary.providerConfigured ? (
        <DashboardStatePanel
          eyebrow="Stripe dev setup"
          title="Checkout disabled until Stripe env is configured"
          description="Заполни STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET и price ids, затем подними local webhook через Stripe CLI. Все шаги есть в docs/BILLING.md."
          tone="warning"
          className="min-h-[220px]"
        />
      ) : null}
    </div>
  );
}