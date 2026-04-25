"use client";

import { useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { DashboardStatePanel } from "@/components/dashboard/dashboard-state-panel";
import { cn, formatCurrency, formatNumber, formatPercent, formatRelativeTime } from "@/lib/utils";
import type {
  SaasAlertAssetOption,
  SaasAlertDirection,
  SaasAlertEventRow,
  SaasAlertPortfolioOption,
  SaasAlertRuleRow,
  SaasAlertRuleStatus,
  SaasAlertRuleType,
  SaasAlertsEvaluationResult,
  SaasWorkspaceLimitSnapshot,
} from "@/types/saas";

const ALERT_TYPE_OPTIONS: { value: SaasAlertRuleType; label: string }[] = [
  { value: "price_above", label: "Цена выше уровня" },
  { value: "price_below", label: "Цена ниже уровня" },
  { value: "portfolio_value_change", label: "Изменение стоимости портфеля" },
  { value: "stale_price", label: "Устаревшие цены" },
  { value: "concentration_risk", label: "Риск концентрации" },
];

const ALERT_STATUS_OPTIONS: { value: SaasAlertRuleStatus; label: string }[] = [
  { value: "active", label: "Активен" },
  { value: "paused", label: "Пауза" },
];

const DIRECTION_OPTIONS: { value: SaasAlertDirection; label: string }[] = [
  { value: "either", label: "Любое направление" },
  { value: "up", label: "Только рост" },
  { value: "down", label: "Только падение" },
];

type AlertsCenterProps = {
  workspaceId: string;
  workspaceName: string;
  defaultCurrency: string;
  defaultRecipientEmail: string | null;
  canManage: boolean;
  portfolios: SaasAlertPortfolioOption[];
  assets: SaasAlertAssetOption[];
  rules: SaasAlertRuleRow[];
  events: SaasAlertEventRow[];
  limitSnapshot: SaasWorkspaceLimitSnapshot;
};

type RuleFormState = {
  name: string;
  type: SaasAlertRuleType;
  status: SaasAlertRuleStatus;
  portfolioId: string;
  assetId: string;
  thresholdValue: string;
  thresholdPercent: string;
  cooldownMinutes: string;
  recipientEmail: string;
  direction: SaasAlertDirection;
};

function isPriceAlert(type: SaasAlertRuleType) {
  return type === "price_above" || type === "price_below";
}

function usesPercentThreshold(type: SaasAlertRuleType) {
  return type === "portfolio_value_change" || type === "concentration_risk";
}

function getStatusTone(status: SaasAlertRuleStatus) {
  return status === "active"
    ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
    : "border-amber-300/25 bg-amber-300/10 text-amber-100";
}

function getEventTone(status: SaasAlertEventRow["status"]) {
  switch (status) {
    case "delivered":
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
    case "failed":
      return "border-rose-400/25 bg-rose-400/10 text-rose-100";
    case "skipped":
      return "border-amber-300/25 bg-amber-300/10 text-amber-100";
    default:
      return "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";
  }
}

function formatRuleTypeLabel(type: SaasAlertRuleType) {
  return ALERT_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

function formatRuleTarget(rule: SaasAlertRuleRow) {
  if (isPriceAlert(rule.type)) {
    return `${rule.portfolioName ?? "Без портфеля"} · ${rule.assetName ?? "Без актива"}`;
  }

  if (rule.type === "portfolio_value_change" || rule.type === "concentration_risk") {
    return rule.portfolioName ?? "Без портфеля";
  }

  return rule.portfolioName ? `Портфель: ${rule.portfolioName}` : "Весь workspace";
}

function getLimitMetric(limitSnapshot: SaasWorkspaceLimitSnapshot, key: "portfolios" | "positions" | "integrations" | "alerts") {
  return limitSnapshot.usage.find((metric) => metric.key === key) ?? null;
}

function formatHistoryRetention(days: number | null) {
  return days === null ? "без лимита" : `${days} дн.`;
}

function formatThreshold(rule: Pick<RuleFormState, "type" | "thresholdValue" | "thresholdPercent"> | SaasAlertRuleRow, currency: string) {
  if (usesPercentThreshold(rule.type)) {
    const value = "thresholdPercent" in rule ? rule.thresholdPercent : null;
    if (typeof value === "number") {
      return formatPercent(value, 1);
    }

    if (typeof value === "string" && value) {
      return formatPercent(Number(value), 1);
    }

    return "—";
  }

  const value = "thresholdValue" in rule ? rule.thresholdValue : null;
  if (rule.type === "stale_price") {
    if (typeof value === "number") {
      return `${formatNumber(value, 0)} stale prices`;
    }

    if (typeof value === "string" && value) {
      return `${formatNumber(Number(value), 0)} stale prices`;
    }

    return "1 stale price";
  }

  if (typeof value === "number") {
    return formatCurrency(value, currency, 2);
  }

  if (typeof value === "string" && value) {
    return formatCurrency(Number(value), currency, 2);
  }

  return "—";
}

function createEmptyForm(portfolios: SaasAlertPortfolioOption[], assets: SaasAlertAssetOption[], defaultRecipientEmail: string | null): RuleFormState {
  const firstPortfolioId = portfolios[0]?.id ?? "";
  const firstAssetId = assets.find((asset) => asset.portfolioId === firstPortfolioId)?.assetId ?? "";

  return {
    name: "",
    type: "price_above",
    status: "active",
    portfolioId: firstPortfolioId,
    assetId: firstAssetId,
    thresholdValue: "",
    thresholdPercent: "",
    cooldownMinutes: "1440",
    recipientEmail: defaultRecipientEmail ?? "",
    direction: "either",
  };
}

function ruleToForm(rule: SaasAlertRuleRow): RuleFormState {
  return {
    name: rule.name,
    type: rule.type,
    status: rule.status,
    portfolioId: rule.portfolioId ?? "",
    assetId: rule.assetId ?? "",
    thresholdValue: rule.thresholdValue !== null ? String(rule.thresholdValue) : "",
    thresholdPercent: rule.thresholdPercent !== null ? String(rule.thresholdPercent) : "",
    cooldownMinutes: String(rule.cooldownMinutes),
    recipientEmail: rule.recipientEmail ?? "",
    direction: rule.direction,
  };
}

function buildPayload(form: RuleFormState) {
  return {
    name: form.name.trim(),
    type: form.type,
    status: form.status,
    portfolioId: form.portfolioId || null,
    assetId: isPriceAlert(form.type) ? form.assetId || null : null,
    thresholdValue: !usesPercentThreshold(form.type) && form.thresholdValue.trim() !== "" ? Number(form.thresholdValue) : null,
    thresholdPercent: usesPercentThreshold(form.type) && form.thresholdPercent.trim() !== "" ? Number(form.thresholdPercent) : null,
    cooldownMinutes: Number(form.cooldownMinutes || "1440"),
    recipientEmail: form.recipientEmail.trim() || null,
    direction: form.direction,
  };
}

export function AlertsCenter({ workspaceId, workspaceName, defaultCurrency, defaultRecipientEmail, canManage, portfolios, assets, rules, events, limitSnapshot }: AlertsCenterProps) {
  const router = useRouter();
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleFormState>(() => createEmptyForm(portfolios, assets, defaultRecipientEmail));
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; message: string } | null>(null);
  const [evaluationSummary, setEvaluationSummary] = useState<SaasAlertsEvaluationResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const alertUsage = getLimitMetric(limitSnapshot, "alerts");
  const alertLimit = alertUsage?.limit ?? null;
  const alertRemaining = alertUsage?.remaining ?? null;
  const alertCreateBlocked = canManage && Boolean(alertLimit !== null && alertRemaining === 0);
  const selectedAssetOptions = assets.filter((asset) => asset.portfolioId === form.portfolioId);

  function resetForm() {
    setEditingRuleId(null);
    setForm(createEmptyForm(portfolios, assets, defaultRecipientEmail));
  }

  function startEditing(rule: SaasAlertRuleRow) {
    setFeedback(null);
    setEvaluationSummary(null);
    setEditingRuleId(rule.id);
    setForm(ruleToForm(rule));
  }

  function updatePortfolioSelection(portfolioId: string) {
    const nextAssetId = assets.find((asset) => asset.portfolioId === portfolioId)?.assetId ?? "";
    setForm((current) => ({
      ...current,
      portfolioId,
      assetId: assets.some((asset) => asset.portfolioId === portfolioId && asset.assetId === current.assetId) ? current.assetId : nextAssetId,
    }));
  }

  function handleTypeChange(type: SaasAlertRuleType) {
    setForm((current) => ({
      ...current,
      type,
      assetId: isPriceAlert(type) ? current.assetId : "",
      thresholdPercent: usesPercentThreshold(type) ? current.thresholdPercent : "",
      direction: type === "portfolio_value_change" ? current.direction : "either",
    }));
  }
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setEvaluationSummary(null);

    if (!editingRuleId && alertCreateBlocked) {
      setFeedback({ tone: "error", message: "Лимит по alerts исчерпан. Откройте Billing и повысьте тариф или включите override." });
      return;
    }

    startTransition(async () => {
      const response = await fetch(editingRuleId ? `/api/app/alerts/rules/${editingRuleId}` : "/api/app/alerts/rules", {
        method: editingRuleId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, ...buildPayload(form) }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setFeedback({ tone: "error", message: payload?.error ?? "Не удалось сохранить alert rule." });
        return;
      }

      setFeedback({ tone: "success", message: editingRuleId ? "Alert rule обновлен." : "Alert rule создан." });
      resetForm();
      router.refresh();
    });
  }

  function toggleRule(rule: SaasAlertRuleRow) {
    setFeedback(null);
    setEvaluationSummary(null);

    startTransition(async () => {
      const nextStatus: SaasAlertRuleStatus = rule.status === "active" ? "paused" : "active";
      const response = await fetch(`/api/app/alerts/rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, ...buildPayload({ ...ruleToForm(rule), status: nextStatus }) }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setFeedback({ tone: "error", message: payload?.error ?? "Не удалось обновить статус rule." });
        return;
      }

      setFeedback({ tone: "success", message: nextStatus === "active" ? "Rule активирован." : "Rule поставлен на паузу." });
      router.refresh();
    });
  }

  function deleteRule(rule: SaasAlertRuleRow) {
    if (!window.confirm(`Удалить alert rule «${rule.name}»?`)) {
      return;
    }

    setFeedback(null);
    setEvaluationSummary(null);

    startTransition(async () => {
      const response = await fetch(`/api/app/alerts/rules/${rule.id}?workspaceId=${workspaceId}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setFeedback({ tone: "error", message: payload?.error ?? "Не удалось удалить rule." });
        return;
      }

      if (editingRuleId === rule.id) {
        resetForm();
      }

      setFeedback({ tone: "success", message: "Alert rule удален." });
      router.refresh();
    });
  }
  function runEvaluation() {
    setFeedback(null);

    startTransition(async () => {
      const response = await fetch("/api/app/alerts/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; result?: SaasAlertsEvaluationResult } | null;
      if (!response.ok || !payload?.result) {
        setFeedback({ tone: "error", message: payload?.error ?? "Не удалось запустить проверку alerts." });
        return;
      }

      setEvaluationSummary(payload.result);
      setFeedback({ tone: "success", message: `Проверка завершена: ${payload.result.triggeredRules} triggered, ${payload.result.deliveredEvents} delivered.` });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="panel rounded-[30px] border border-white/10 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-[0.68rem] uppercase tracking-[0.32em] text-cyan-200/65">Alerts center</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Сигналы и уведомления для {workspaceName}</h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300/80">
              Настраивайте правила для цены актива, изменения стоимости портфеля, stale quotes и риска концентрации. Проверка может запускаться вручную или по cron route.
            </p>
          </div>
          <button
            type="button"
            disabled={isPending || !canManage}
            onClick={runEvaluation}
            className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Проверяю..." : "Проверить alerts сейчас"}
          </button>
        </div>

        <div className={`mt-5 rounded-2xl px-4 py-4 text-sm leading-7 ${alertCreateBlocked ? "border border-rose-400/30 bg-rose-400/10 text-rose-100" : alertUsage?.isNearLimit ? "border border-amber-300/25 bg-amber-300/10 text-amber-100" : "border border-white/10 bg-white/[0.03] text-slate-300/82"}`}>
          <p>Plan <span className="font-semibold text-white">{limitSnapshot.plan}</span>: использовано {alertUsage?.used ?? rules.length}{alertLimit !== null ? ` из ${alertLimit}` : ""} alert rules.{alertRemaining !== null ? ` Осталось ${alertRemaining}.` : ""}</p>
          <p className="mt-2">History retention: {formatHistoryRetention(limitSnapshot.effectiveLimits.historyRetentionDays)}.</p>
          {canManage ? (
            <Link href="/app/billing" className="mt-3 inline-flex rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-100 transition hover:border-white/20 hover:text-white">
              Открыть Billing
            </Link>
          ) : null}
        </div>

        {feedback ? (
          <div className={cn("mt-5 rounded-2xl px-4 py-3 text-sm", feedback.tone === "error" ? "border border-rose-400/30 bg-rose-400/10 text-rose-100" : "border border-emerald-400/30 bg-emerald-400/10 text-emerald-100")}>
            {feedback.message}
          </div>
        ) : null}

        {evaluationSummary ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Checked</p><p className="mt-2 text-lg font-medium text-white">{evaluationSummary.checkedRules}</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Triggered</p><p className="mt-2 text-lg font-medium text-white">{evaluationSummary.triggeredRules}</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Delivered</p><p className="mt-2 text-lg font-medium text-emerald-200">{evaluationSummary.deliveredEvents}</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Failed</p><p className="mt-2 text-lg font-medium text-rose-200">{evaluationSummary.failedEvents}</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Skipped</p><p className="mt-2 text-lg font-medium text-amber-100">{evaluationSummary.skippedEvents}</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Cooldown</p><p className="mt-2 text-lg font-medium text-white">{evaluationSummary.suppressedByCooldown}</p></div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="panel rounded-[30px] border border-white/10 px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.68rem] uppercase tracking-[0.32em] text-cyan-200/65">Rule editor</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">{editingRuleId ? "Редактирование alert rule" : "Новый alert rule"}</h3>
            </div>
            {editingRuleId ? <button type="button" onClick={resetForm} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:text-white">Отмена</button> : null}
          </div>

          {!canManage ? (
            <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-4 text-sm text-amber-100">У вас только просмотр. Создание, изменение и ручной запуск alerts доступны ролям owner/admin.</div>
          ) : (
            <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2"><span className="text-sm text-slate-300/78">Название</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} disabled={isPending} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60" placeholder="CS2 portfolio > $5k" /></label>
                <label className="grid gap-2"><span className="text-sm text-slate-300/78">Тип сигнала</span><select value={form.type} onChange={(event) => handleTypeChange(event.target.value as SaasAlertRuleType)} disabled={isPending} className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-300/60">{ALERT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <label className="grid gap-2"><span className="text-sm text-slate-300/78">Портфель</span><select value={form.portfolioId} onChange={(event) => updatePortfolioSelection(event.target.value)} disabled={isPending} className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-300/60"><option value="">Весь workspace</option>{portfolios.map((portfolio) => <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>)}</select></label>
                <label className="grid gap-2"><span className="text-sm text-slate-300/78">Статус</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as SaasAlertRuleStatus }))} disabled={isPending} className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-300/60">{ALERT_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                {isPriceAlert(form.type) ? <label className="grid gap-2 sm:col-span-2"><span className="text-sm text-slate-300/78">Актив</span><select value={form.assetId} onChange={(event) => setForm((current) => ({ ...current, assetId: event.target.value }))} disabled={isPending || selectedAssetOptions.length === 0} className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-300/60"><option value="">Выберите актив</option>{selectedAssetOptions.map((asset) => <option key={`${asset.portfolioId}-${asset.assetId}`} value={asset.assetId}>{asset.assetName}{asset.symbol ? ` (${asset.symbol})` : ""}</option>)}</select></label> : null}
                {!usesPercentThreshold(form.type) ? <label className="grid gap-2"><span className="text-sm text-slate-300/78">{form.type === "stale_price" ? "Минимум stale prices" : "Пороговое значение"}</span><input value={form.thresholdValue} onChange={(event) => setForm((current) => ({ ...current, thresholdValue: event.target.value }))} disabled={isPending} inputMode="decimal" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60" placeholder={form.type === "stale_price" ? "1" : "5000"} /></label> : <label className="grid gap-2"><span className="text-sm text-slate-300/78">Порог в процентах</span><input value={form.thresholdPercent} onChange={(event) => setForm((current) => ({ ...current, thresholdPercent: event.target.value }))} disabled={isPending} inputMode="decimal" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60" placeholder="15" /></label>}
                <label className="grid gap-2"><span className="text-sm text-slate-300/78">Cooldown (минуты)</span><input value={form.cooldownMinutes} onChange={(event) => setForm((current) => ({ ...current, cooldownMinutes: event.target.value }))} disabled={isPending} inputMode="numeric" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60" placeholder="1440" /></label>
                <label className="grid gap-2 sm:col-span-2"><span className="text-sm text-slate-300/78">Email получателя</span><input value={form.recipientEmail} onChange={(event) => setForm((current) => ({ ...current, recipientEmail: event.target.value }))} disabled={isPending} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60" placeholder="alerts@your-domain.com" /></label>
                {form.type === "portfolio_value_change" ? <label className="grid gap-2 sm:col-span-2"><span className="text-sm text-slate-300/78">Направление</span><select value={form.direction} onChange={(event) => setForm((current) => ({ ...current, direction: event.target.value as SaasAlertDirection }))} disabled={isPending} className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-300/60">{DIRECTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label> : null}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-slate-300/80">Текущий порог: <span className="text-white">{formatThreshold(form, defaultCurrency)}</span><span className="mx-2 text-white/20">•</span>Email channel: <span className="text-white">email</span></div>
              <div className="flex flex-wrap gap-3"><button type="submit" disabled={isPending || (!editingRuleId && alertCreateBlocked)} className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60">{isPending ? "Сохраняю..." : editingRuleId ? "Сохранить rule" : alertCreateBlocked ? "Лимит достигнут" : "Создать rule"}</button>{editingRuleId ? <button type="button" onClick={resetForm} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-white/20 hover:text-white">Сбросить редактор</button> : null}</div>
            </form>
          )}
        </section>
        <section className="panel rounded-[30px] border border-white/10 px-5 py-5 sm:px-6">
          <p className="text-[0.68rem] uppercase tracking-[0.32em] text-cyan-200/65">Alert rules</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Активные правила и паузы</h3>
          <div className="mt-5 space-y-3">
            {rules.length === 0 ? (
              <DashboardStatePanel eyebrow="Alerts" title="Правила еще не созданы" description="Создайте первый alert rule, чтобы получать сигналы по цене, stale quotes или концентрации риска." className="min-h-[260px]" />
            ) : (
              rules.map((rule) => (
                <article key={rule.id} className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-semibold text-white">{rule.name}</h4>
                        <span className={cn("rounded-full border px-3 py-1 text-[0.7rem] uppercase tracking-[0.18em]", getStatusTone(rule.status))}>{rule.status}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">{formatRuleTypeLabel(rule.type)} · {formatRuleTarget(rule)}</p>
                    </div>
                    {canManage ? (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => startEditing(rule)} className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100 transition hover:border-cyan-300/40">Редактировать</button>
                        <button type="button" onClick={() => toggleRule(rule)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:text-white">{rule.status === "active" ? "Пауза" : "Активировать"}</button>
                        <button type="button" onClick={() => deleteRule(rule)} className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-2 text-sm text-rose-100 transition hover:border-rose-400/40">Удалить</button>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Порог</p><p className="mt-2 text-sm text-white">{formatThreshold(rule, defaultCurrency)}</p></div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Cooldown</p><p className="mt-2 text-sm text-white">{formatNumber(rule.cooldownMinutes, 0)} мин</p></div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Последняя проверка</p><p className="mt-2 text-sm text-white">{rule.lastEvaluatedAt ? formatRelativeTime(rule.lastEvaluatedAt) : "Еще не проверялся"}</p></div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Последний trigger</p><p className="mt-2 text-sm text-white">{rule.lastTriggeredAt ? formatRelativeTime(rule.lastTriggeredAt) : "Не срабатывал"}</p></div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300/78">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Канал: {rule.channel}</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Recipient: {rule.recipientEmail ?? "не задан"}</span>
                    {rule.type === "portfolio_value_change" ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Direction: {rule.direction}</span> : null}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </section>

      <section className="panel rounded-[30px] border border-white/10 px-5 py-5 sm:px-6">
        <p className="text-[0.68rem] uppercase tracking-[0.32em] text-cyan-200/65">Alert history</p>
        <h3 className="mt-2 text-2xl font-semibold text-white">Последние события</h3>
        <div className="mt-5 space-y-3">
          {events.length === 0 ? (
            <DashboardStatePanel eyebrow="History" title="История alert events пока пуста" description="После первого trigger здесь появятся delivered, failed и skipped события с объяснением причины." className="min-h-[240px]" />
          ) : (
            events.map((event) => (
              <article key={event.id} className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-semibold text-white">{event.title}</h4>
                      <span className={cn("rounded-full border px-3 py-1 text-[0.7rem] uppercase tracking-[0.18em]", getEventTone(event.status))}>{event.status}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">{event.ruleName ?? formatRuleTypeLabel(event.type)}{event.portfolioName ? ` · ${event.portfolioName}` : ""}{event.assetName ? ` · ${event.assetName}` : ""}</p>
                  </div>
                  <p className="text-sm text-slate-300/78">{formatRelativeTime(event.triggeredAt)}</p>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-300/82">{event.message}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300/78">
                  {event.metricValue !== null ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Metric: {usesPercentThreshold(event.type) ? formatPercent(event.metricValue, 1) : formatNumber(event.metricValue, 2)}</span> : null}
                  {event.thresholdValue !== null ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Threshold: {usesPercentThreshold(event.type) ? formatPercent(event.thresholdValue, 1) : formatNumber(event.thresholdValue, 2)}</span> : null}
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Email: {event.recipientEmail ?? "не задан"}</span>
                  {event.deliveredAt ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Delivered {formatRelativeTime(event.deliveredAt)}</span> : null}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
