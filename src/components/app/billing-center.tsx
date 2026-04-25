"use client";

import { useMemo, useState, useTransition } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { DashboardStatePanel } from "@/components/dashboard/dashboard-state-panel";
import { cn, formatNumber } from "@/lib/utils";
import type { SaasWorkspaceBillingSummary } from "@/types/saas";

function formatDate(value: string | null) {
  if (!value) {
    return "РІР‚вЂќ";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatPlanStatus(status: SaasWorkspaceBillingSummary["currentSubscription"]["status"]) {
  switch (status) {
    case "active":
      return "Р С’Р С”РЎвЂљР С‘Р Р†Р Р…Р В°";
    case "trialing":
      return "Р СћРЎР‚Р С‘Р В°Р В»";
    case "past_due":
      return "Р СџРЎР‚Р С•РЎРѓРЎР‚Р С•РЎвЂЎР С”Р В°";
    case "canceled":
      return "Р С›РЎвЂљР СР ВµР Р…Р ВµР Р…Р В°";
    default:
      return "Р СњР ВµР С—Р С•Р В»Р Р…Р В°РЎРЏ";
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

function getUsageTone(metric: SaasWorkspaceBillingSummary["usage"][number]) {
  if (metric.isExceeded) {
    return "border-rose-400/25 bg-rose-400/10 text-rose-100";
  }

  if (metric.isNearLimit) {
    return "border-amber-300/25 bg-amber-300/10 text-amber-100";
  }

  return "border-white/10 bg-white/5 text-slate-100";
}

function formatLimit(value: number | null, unit: string) {
  if (value === null) {
    return "Р В±Р ВµР В· Р В»Р С‘Р СР С‘РЎвЂљР В°";
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
      message: "Checkout Р В·Р В°Р Р†Р ВµРЎР‚РЎв‚¬Р ВµР Р…. Р СџР С•РЎРѓР В»Р Вµ webhook-РЎРѓР С‘Р Р…РЎвЂ¦РЎР‚Р С•Р Р…Р С‘Р В·Р В°РЎвЂ Р С‘Р С‘ РЎРѓРЎвЂљР В°РЎвЂљРЎС“РЎРѓ Р С—Р С•Р Т‘Р С—Р С‘РЎРѓР С”Р С‘ Р С•Р В±Р Р…Р С•Р Р†Р С‘РЎвЂљРЎРѓРЎРЏ Р Р† PostgreSQL.",
    };
  }

  if (checkoutState === "cancel") {
    return {
      tone: "warning" as const,
      message: "Checkout Р С•РЎвЂљР СР ВµР Р…Р ВµР Р…. Р СћР В°РЎР‚Р С‘РЎвЂћ Р Р…Р Вµ Р С‘Р В·Р СР ВµР Р…Р ВµР Р….",
    };
  }

  if (portalState === "returned") {
    return {
      tone: "neutral" as const,
      message: "Р вЂ™РЎвЂ№ Р Р†Р ВµРЎР‚Р Р…РЎС“Р В»Р С‘РЎРѓРЎРЉ Р С‘Р В· Stripe Customer Portal. Р С›Р В±Р Р…Р С•Р Р†Р С‘РЎвЂљР Вµ РЎРѓРЎвЂљРЎР‚Р В°Р Р…Р С‘РЎвЂ РЎС“, Р ВµРЎРѓР В»Р С‘ РЎвЂљР С•Р В»РЎРЉР С”Р С• РЎвЂЎРЎвЂљР С• Р СР ВµР Р…РЎРЏР В»Р С‘ Р С—Р С•Р Т‘Р С—Р С‘РЎРѓР С”РЎС“.",
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

      const payload = (await response.json().catch(() => null)) as { error?: string; url?: string } | null;

      if (!response.ok || !payload?.url) {
        setFeedback({
          tone: "error",
          message: payload?.error ?? "Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р С•РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљРЎРЉ Stripe Checkout.",
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

      const payload = (await response.json().catch(() => null)) as { error?: string; url?: string } | null;

      if (!response.ok || !payload?.url) {
        setFeedback({
          tone: "error",
          message: payload?.error ?? "Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р С•РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљРЎРЉ Stripe Customer Portal.",
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
        <div className={cn("rounded-[26px] border px-5 py-4 text-sm leading-7", flash.tone === "success" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100" : flash.tone === "warning" ? "border-amber-300/25 bg-amber-300/10 text-amber-100" : "border-cyan-300/25 bg-cyan-300/10 text-cyan-100")}>
          {flash.message}
        </div>
      ) : null}

      {feedback ? (
        <div className={cn("rounded-[26px] border px-5 py-4 text-sm leading-7", feedback.tone === "success" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100" : feedback.tone === "warning" ? "border-amber-300/25 bg-amber-300/10 text-amber-100" : "border-rose-400/25 bg-rose-400/10 text-rose-100")}>
          {feedback.message}
        </div>
      ) : null}

      {summary.currentSubscription.overrideLimitsEnabled ? (
        <section className="rounded-[26px] border border-violet-300/25 bg-violet-300/10 px-5 py-4 text-sm leading-7 text-violet-100">
          <p className="font-semibold text-white">Admin override Р В°Р С”РЎвЂљР С‘Р Р†Р ВµР Р…</p>
          <p className="mt-2">Р вЂќР В»РЎРЏ РЎРЊРЎвЂљР С•Р С–Р С• workspace effective limits Р С—Р ВµРЎР‚Р ВµР С•Р С—РЎР‚Р ВµР Т‘Р ВµР В»РЎРЏРЎР‹РЎвЂљРЎРѓРЎРЏ Р С—Р С•Р Р†Р ВµРЎР‚РЎвЂ¦ РЎвЂљР В°РЎР‚Р С‘РЎвЂћР Р…Р С•Р С–Р С• Р С—Р В»Р В°Р Р…Р В°.</p>
          {summary.currentSubscription.overrideNotes ? <p className="mt-2 text-violet-50/90">Р С™Р С•Р СР СР ВµР Р…РЎвЂљР В°РЎР‚Р С‘Р в„–: {summary.currentSubscription.overrideNotes}</p> : null}
        </section>
      ) : null}

      {summary.warnings.length > 0 ? (
        <div className="space-y-3">
          {summary.warnings.map((warning) => (
            <div key={warning} className="rounded-[24px] border border-amber-300/20 bg-amber-300/10 px-5 py-4 text-sm leading-7 text-amber-50/92">
              {warning}
            </div>
          ))}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(7,16,31,0.96),rgba(13,43,65,0.86))] p-5 sm:p-6">
          <p className="text-[0.68rem] uppercase tracking-[0.32em] text-cyan-200/72">Stripe billing</p>
          <h3 className="mt-3 text-2xl font-semibold text-white sm:text-[1.8rem]">{summary.workspaceName} Р’В· {summary.plans.find((plan) => plan.plan === activePlan)?.label ?? activePlan}</h3>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200/82">
            Stage 26 Р Р†Р С”Р В»РЎР‹РЎвЂЎР В°Р ВµРЎвЂљ Р В¶Р ВµРЎРѓРЎвЂљР С”Р С•Р Вµ Р С—РЎР‚Р С‘Р СР ВµР Р…Р ВµР Р…Р С‘Р Вµ Р В»Р С‘Р СР С‘РЎвЂљР С•Р Р†: РЎРѓР С•Р В·Р Т‘Р В°Р Р…Р С‘Р Вµ Р С—Р С•РЎР‚РЎвЂљРЎвЂћР ВµР В»Р ВµР в„–, РЎР‚РЎС“РЎвЂЎР Р…РЎвЂ№РЎвЂ¦ Р С—Р С•Р В·Р С‘РЎвЂ Р С‘Р в„–, alert rules Р С‘ import commit РЎвЂљР ВµР С—Р ВµРЎР‚РЎРЉ Р С•Р С—Р С‘РЎР‚Р В°РЎР‹РЎвЂљРЎРѓРЎРЏ Р Р…Р В° Р ВµР Т‘Р С‘Р Р…РЎвЂ№Р в„– limit service. Price refresh Р С‘ history retention РЎвЂљР С•Р В¶Р Вµ Р С—РЎР‚Р С‘Р СР ВµР Р…РЎРЏРЎР‹РЎвЂљРЎРѓРЎРЏ РЎвЂ Р ВµР Р…РЎвЂљРЎР‚Р В°Р В»Р С‘Р В·Р С•Р Р†Р В°Р Р…Р Р…Р С•.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-[0.68rem] uppercase tracking-[0.22em] text-slate-200/82">
            <span className={cn("rounded-full border px-3 py-1", getStatusTone(summary.currentSubscription.status))}>{formatPlanStatus(summary.currentSubscription.status)}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Seats {summary.currentSubscription.seatCount}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Provider {summary.currentSubscription.billingProvider ?? "none"}</span>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-100"><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Current period end</p><p className="mt-2 text-base font-semibold text-white">{formatDate(summary.currentSubscription.currentPeriodEnd)}</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-100"><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Trial ends</p><p className="mt-2 text-base font-semibold text-white">{formatDate(summary.currentSubscription.trialEndsAt)}</p></div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-100"><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Price refresh gate</p><p className="mt-2 text-base font-semibold text-white">{formatLimit(summary.limits.effectiveLimits.priceRefreshHours, "РЎвЂЎ")}</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-100"><p className="text-xs uppercase tracking-[0.2em] text-slate-400">History retention</p><p className="mt-2 text-base font-semibold text-white">{formatLimit(summary.limits.effectiveLimits.historyRetentionDays, "Р Т‘Р Р….")}</p></div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={handlePortal} disabled={isPending || !summary.canManage || !summary.customerPortalReady} className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60">{isPending ? "Р С›РЎвЂљР С”РЎР‚РЎвЂ№Р Р†Р В°РЎР‹..." : "Stripe Customer Portal"}</button>
            <button type="button" onClick={() => router.refresh()} disabled={isPending} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60">Р С›Р В±Р Р…Р С•Р Р†Р С‘РЎвЂљРЎРЉ РЎРѓРЎвЂљР В°РЎвЂљРЎС“РЎРѓ</button>
          </div>
        </div>

        <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <h3 className="text-xl font-semibold text-white">Usage vs plan limits</h3>
          <p className="mt-2 text-sm leading-7 text-slate-300/74">Р СњР С‘Р В¶Р Вµ Р С—Р С•Р С”Р В°Р В·Р В°Р Р…РЎвЂ№ РЎвЂљР ВµР С”РЎС“РЎвЂ°Р С‘Р Вµ usage counters, effective limits Р С‘ РЎРѓРЎвЂљР В°РЎвЂљРЎС“РЎРѓ Р С—РЎР‚Р С‘Р В±Р В»Р С‘Р В¶Р ВµР Р…Р С‘РЎРЏ Р С” Р В»Р С‘Р СР С‘РЎвЂљРЎС“. Р С™Р С•Р С–Р Т‘Р В° РЎРѓРЎвЂЎР ВµРЎвЂљРЎвЂЎР С‘Р С” Р Т‘Р С•РЎРѓРЎвЂљР С‘Р С–Р В°Р ВµРЎвЂљ Р С”Р В°Р С—Р В°, РЎРѓР С•Р С•РЎвЂљР Р†Р ВµРЎвЂљРЎРѓРЎвЂљР Р†РЎС“РЎР‹РЎвЂ°Р С‘Р Вµ write-Р С•Р С—Р ВµРЎР‚Р В°РЎвЂ Р С‘Р С‘ Р В±Р В»Р С•Р С”Р С‘РЎР‚РЎС“РЎР‹РЎвЂљРЎРѓРЎРЏ Р Р…Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚Р Вµ.</p>
          <div className="mt-5 space-y-3">
            {summary.usage.map((item) => (
              <div key={item.key} className={cn("rounded-[24px] border px-4 py-4", getUsageTone(item))}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    <p className="mt-2 text-sm text-slate-300/80">{item.used} used Р’В· {item.limit === null ? "Р В±Р ВµР В· Р В»Р С‘Р СР С‘РЎвЂљР В°" : `${item.limit} max`} Р’В· {item.remaining === null ? "РІв‚¬С› left" : `${item.remaining} left`}</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300/84">{item.unit}</span>
                </div>
                {item.utilizationPercent !== null ? (<div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className={cn("h-full rounded-full transition-all", item.isExceeded ? "bg-rose-300" : item.isNearLimit ? "bg-amber-300" : "bg-cyan-300")} style={{ width: `${Math.min(item.utilizationPercent, 100)}%` }} /></div>) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
        {summary.plans.map((plan) => {
          const isUpgradeTarget = activePlan !== plan.plan && plan.plan !== "free";

          return (
            <article key={plan.plan} className={cn("rounded-[28px] border p-5 sm:p-6", plan.isCurrent ? "border-cyan-300/30 bg-cyan-300/[0.08]" : "border-white/10 bg-white/[0.03]")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/72">{plan.plan}</p>
                  <h3 className="mt-3 text-2xl font-semibold text-white">{plan.label}</h3>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-200/84">{plan.monthlyPriceUsd === 0 ? "Free" : `$${plan.monthlyPriceUsd}/mo`}</span>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-300/78">{plan.description}</p>
              <div className="mt-5 grid gap-2 text-sm text-slate-200">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">Р СџР С•РЎР‚РЎвЂљРЎвЂћР ВµР В»Р С‘: {formatLimit(plan.limits.portfolios, "РЎв‚¬РЎвЂљ.")}</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">Р СџР С•Р В·Р С‘РЎвЂ Р С‘Р С‘: {formatLimit(plan.limits.positions, "РЎв‚¬РЎвЂљ.")}</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">Р ВР Р…РЎвЂљР ВµР С–РЎР‚Р В°РЎвЂ Р С‘Р С‘: {formatLimit(plan.limits.integrations, "РЎв‚¬РЎвЂљ.")}</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">Alerts: {formatLimit(plan.limits.alerts, "РЎв‚¬РЎвЂљ.")}</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">Price refresh gate: {formatLimit(plan.limits.priceRefreshHours, "РЎвЂЎ")}</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">History retention: {formatLimit(plan.limits.historyRetentionDays, "Р Т‘Р Р….")}</div>
              </div>
              <div className="mt-5 space-y-2 text-sm leading-7 text-slate-300/82">{plan.highlights.map((highlight) => (<p key={`${plan.plan}-${highlight}`}>{highlight}</p>))}</div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" onClick={() => isUpgradeTarget && handleCheckout(plan.plan as "pro" | "whale" | "team")} disabled={isPending || !isUpgradeTarget || !plan.canCheckout} className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60">{plan.isCurrent ? "Р СћР ВµР С”РЎС“РЎвЂ°Р С‘Р в„– Р С—Р В»Р В°Р Р…" : !plan.stripePriceConfigured ? "Price ID missing" : "Р СџР ВµРЎР‚Р ВµР в„–РЎвЂљР С‘ Р Р…Р В° Р С—Р В»Р В°Р Р…"}</button>
                {plan.isCurrent ? <span className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">Р С’Р С”РЎвЂљР С‘Р Р†Р ВµР Р… РЎРѓР ВµР в„–РЎвЂЎР В°РЎРѓ</span> : null}
              </div>
            </article>
          );
        })}
      </section>

      {!summary.providerConfigured ? (
        <DashboardStatePanel eyebrow="Stripe dev setup" title="Checkout Р С•РЎвЂљР С”Р В»РЎР‹РЎвЂЎР ВµР Р…, Р С—Р С•Р С”Р В° Р Р…Р Вµ Р Р…Р В°РЎРѓРЎвЂљРЎР‚Р С•Р ВµР Р…РЎвЂ№ Stripe env" description="Р вЂ”Р В°Р С—Р С•Р В»Р Р…Р С‘РЎвЂљР Вµ Stripe secret, Stripe webhook secret Р С‘ price ids, Р В·Р В°РЎвЂљР ВµР С Р С—Р С•Р Т‘Р Р…Р С‘Р СР С‘РЎвЂљР Вµ webhook РЎвЂЎР ВµРЎР‚Р ВµР В· Stripe CLI. Р вЂ™РЎРѓР Вµ РЎв‚¬Р В°Р С–Р С‘ Р С•Р С—Р С‘РЎРѓР В°Р Р…РЎвЂ№ Р Р† docs/BILLING.md." tone="warning" className="min-h-[220px]" />
      ) : null}
    </div>
  );
}