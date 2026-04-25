"use client";

import { useEffect, useState } from "react";

import { PrivateDashboardNav } from "@/components/dashboard/private-dashboard-nav";
import { SectionCard } from "@/components/dashboard/section-card";
import { getDashboardTokenFromUrl, getLocalDateKey } from "@/lib/client/dashboard-client";
import { cn, formatRelativeTime } from "@/lib/utils";
import type {
  DashboardHealthActionResponse,
  DashboardHealthSnapshot,
  HealthActionType,
  HealthIndicator,
  SheetValidationIssue,
} from "@/types/health";

function toneClass(tone: HealthIndicator["tone"]) {
  if (tone === "ok") {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
  }

  if (tone === "warning") {
    return "border-amber-300/20 bg-amber-300/10 text-amber-100";
  }

  if (tone === "error") {
    return "border-rose-400/20 bg-rose-400/10 text-rose-100";
  }

  return "border-cyan-300/20 bg-cyan-300/10 text-cyan-100";
}

function toneLabel(tone: HealthIndicator["tone"]) {
  if (tone === "ok") {
    return "OK";
  }

  if (tone === "warning") {
    return "Warning";
  }

  if (tone === "error") {
    return "Error";
  }

  return "Info";
}

function IndicatorCard({ indicator }: { indicator: HealthIndicator }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{indicator.label}</p>
          <p className="mt-3 text-sm leading-6 text-slate-200/90">{indicator.summary}</p>
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.18em]",
            toneClass(indicator.tone),
          )}
        >
          {toneLabel(indicator.tone)}
        </span>
      </div>
      {indicator.details.length > 0 ? (
        <div className="mt-4 space-y-2 text-xs leading-5 text-slate-400">
          {indicator.details.map((detail) => (
            <p key={detail}>{detail}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ValidationIssueCard({ issue }: { issue: SheetValidationIssue }) {
  const tone =
    issue.kind === "ok"
      ? "ok"
      : issue.kind === "legacy_alias"
        ? "info"
        : "warning";

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-white">{issue.logicalTab}</p>
          <p className="mt-1 text-xs text-slate-400">
            {issue.matchedTab ? `Matched sheet: ${issue.matchedTab}` : "Лист не найден"}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.18em]",
            toneClass(tone),
          )}
        >
          {issue.kind.replace(/_/g, " ")}
        </span>
      </div>
      {issue.headers.length > 0 ? (
        <p className="mt-3 text-xs leading-5 text-slate-400">Headers: {issue.headers.join(", ")}</p>
      ) : null}
      {issue.missingFields.length > 0 ? (
        <p className="mt-3 text-xs leading-5 text-amber-100/85">
          Missing required: {issue.missingFields.join(", ")}
        </p>
      ) : null}
      {issue.kind === "missing_canonical" ? (
        <p className="mt-3 text-xs leading-5 text-slate-400">
          Accepted aliases: {issue.acceptedAliases.join(", ")}
        </p>
      ) : null}
    </div>
  );
}

function ActionButton({
  label,
  action,
  busyAction,
  onClick,
}: {
  label: string;
  action: HealthActionType;
  busyAction: HealthActionType | null;
  onClick: () => void;
}) {
  const isBusy = busyAction === action;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busyAction !== null}
      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {isBusy ? "Выполняю..." : label}
    </button>
  );
}

export function SettingsHealthShell({
  initialHealth,
  dashboardSlug,
}: {
  initialHealth: DashboardHealthSnapshot;
  dashboardSlug: string;
}) {
  const [health, setHealth] = useState(initialHealth);
  const [busyAction, setBusyAction] = useState<HealthActionType | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [actionResult, setActionResult] = useState<DashboardHealthActionResponse | null>(null);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function dashboardFetch(input: RequestInfo | URL, init?: RequestInit) {
    const headers = new Headers(init?.headers);
    const token = getDashboardTokenFromUrl();

    if (token && !headers.has("x-dashboard-token")) {
      headers.set("x-dashboard-token", token);
    }

    return fetch(input, {
      ...init,
      cache: "no-store",
      headers,
    });
  }

  async function runAction(action: HealthActionType, replaceExisting = false) {
    setBusyAction(action);

    try {
      const response = await dashboardFetch("/api/private/health/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          replaceExisting,
          date: action === "create_snapshot" ? getLocalDateKey() : undefined,
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | DashboardHealthActionResponse
        | {
            error?: string;
            code?: string;
            conflict?: { date: string; rowNumber: number; sheetName: string };
          }
        | null;

      if (
        response.status === 409 &&
        action === "create_snapshot" &&
        body &&
        "code" in body &&
        body.code === "snapshot_exists"
      ) {
        const conflictDate = body.conflict?.date ?? getLocalDateKey();
        const confirmed = window.confirm(
          `Snapshot за ${conflictDate} уже существует. Обновить его текущими значениями?`,
        );

        if (!confirmed) {
          return;
        }

        await runAction(action, true);
        return;
      }

      if (!response.ok || !body || !("ok" in body) || !body.ok) {
        throw new Error(
          (body && "error" in body ? body.error : undefined) ??
            "Не удалось выполнить действие health page.",
        );
      }

      setHealth(body.health);
      setActionResult(body);
      setToast({
        tone: "success",
        message: body.message,
      });
    } catch (error) {
      setToast({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Health action завершился ошибкой.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <>
      <main className="relative overflow-hidden pb-16">
        <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          <section className="panel relative overflow-hidden rounded-[34px] border border-white/10 px-5 py-6 shadow-[0_30px_100px_rgba(2,8,23,0.72)] sm:px-7 sm:py-7 lg:px-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,209,160,0.12),transparent_34%),radial-gradient(circle_at_top_right,rgba(61,139,255,0.14),transparent_38%),linear-gradient(120deg,rgba(255,255,255,0.02),transparent_45%)]" />
            <div className="relative space-y-6">
              <PrivateDashboardNav dashboardSlug={dashboardSlug} />

              <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr] xl:items-end">
                <div className="space-y-5">
                  <div className="flex flex-wrap gap-3 text-[0.7rem] uppercase tracking-[0.28em] text-cyan-200/70">
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/8 px-3 py-1.5">
                      Settings / Health
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-300">
                      {health.documentTitle ?? "Документ не определен"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-300">
                      {health.documentMode === "unavailable" ? "No source" : health.documentMode}
                    </span>
                  </div>
                  <div>
                    <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-[2.6rem]">
                      Диагностика приватного investment dashboard
                    </h1>
                    <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-300/82 sm:text-base lg:text-lg">
                      Эта страница показывает, что именно работает на проде прямо сейчас: token-gate, чтение и запись в Google Sheets, provider-слои, cache и состояние структуры таблицы.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-slate-300">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                      Последний refresh: {health.lastPortfolioRefresh ? formatRelativeTime(health.lastPortfolioRefresh) : "—"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                      Последний snapshot: {health.lastSnapshotDate ?? "—"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                      {health.availableSheets.length} листов
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <ActionButton
                    label="Refresh portfolio cache"
                    action="refresh_cache"
                    busyAction={busyAction}
                    onClick={() => {
                      runAction("refresh_cache").catch(() => undefined);
                    }}
                  />
                  <ActionButton
                    label="Validate Google Sheet"
                    action="validate_google_sheet"
                    busyAction={busyAction}
                    onClick={() => {
                      runAction("validate_google_sheet").catch(() => undefined);
                    }}
                  />
                  <ActionButton
                    label="Create snapshot"
                    action="create_snapshot"
                    busyAction={busyAction}
                    onClick={() => {
                      runAction("create_snapshot").catch(() => undefined);
                    }}
                  />
                  <ActionButton
                    label="Test price providers"
                    action="test_price_providers"
                    busyAction={busyAction}
                    onClick={() => {
                      runAction("test_price_providers").catch(() => undefined);
                    }}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {health.statuses.map((indicator) => (
              <IndicatorCard key={indicator.id} indicator={indicator} />
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            {health.providers.map((indicator) => (
              <IndicatorCard key={indicator.id} indicator={indicator} />
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <SectionCard
              title="Google Sheet validation"
              eyebrow="Schema check"
              description="Runtime compatibility и canonical readiness проверяются без вывода env secrets."
              aside={
                health.validation ? (
                  <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em]">
                    <span
                      className={cn(
                        "rounded-full border px-3 py-1.5",
                        health.validation.runtimeCompatible ? toneClass("ok") : toneClass("error"),
                      )}
                    >
                      Runtime {health.validation.runtimeCompatible ? "OK" : "FAIL"}
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-3 py-1.5",
                        health.validation.canonicalReady ? toneClass("ok") : toneClass("warning"),
                      )}
                    >
                      Canonical {health.validation.canonicalReady ? "READY" : "PENDING"}
                    </span>
                  </div>
                ) : null
              }
            >
              {health.validation ? (
                <div className="space-y-4">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                    <p>Документ: {health.validation.spreadsheetTitle}</p>
                    <p className="mt-2">Source mode: {health.validation.sourceMode}</p>
                    <p className="mt-2">
                      Available tabs: {health.validation.availableTabs.join(", ") || "—"}
                    </p>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {health.validation.issues.map((issue) => (
                      <ValidationIssueCard
                        key={`${issue.logicalTab}:${issue.kind}:${issue.matchedTab ?? "none"}`}
                        issue={issue}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-amber-300/20 bg-amber-300/8 px-4 py-5 text-sm leading-6 text-amber-100">
                  Validation недоступен, пока Google Sheets read access не восстановлен.
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Cache и warnings"
              eyebrow="Operational view"
              description="Быстрый срез по памяти кэша, in-flight запросам и системным предупреждениям snapshot-сборки."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Cache</p>
                  <p className="mt-3 text-2xl font-semibold text-white">{health.cache.totalEntries}</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-300">
                    <p>Driver: {health.cache.driver}</p>
                    <p>Price entries: {health.cache.priceEntries}</p>
                    <p>Source entries: {health.cache.sourceEntries}</p>
                    <p>In-flight: {health.cache.inFlightEntries}</p>
                    <p>Remote: {health.cache.remoteEnabled ? health.cache.remoteHealthy === false ? "degraded" : health.cache.remoteHealthy === true ? "healthy" : "pending" : "disabled"}</p>
                  </div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Write access</p>
                  <p className="mt-3 text-2xl font-semibold text-white">
                    {health.admin.canWrite ? "Enabled" : "Read-only"}
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-slate-300">
                    <p>Mode: {health.admin.mode}</p>
                    <p>File: {health.admin.fileName ?? "—"}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-sm leading-6 text-slate-300">
                {health.cache.remoteSummary}
              </div>

              {health.warnings.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {health.warnings.map((warning) => (
                    <div
                      key={warning}
                      className="rounded-2xl border border-amber-300/20 bg-amber-300/8 px-4 py-3 text-sm leading-6 text-amber-100/92"
                    >
                      {warning}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-3xl border border-emerald-400/18 bg-emerald-400/8 px-4 py-4 text-sm text-emerald-100">
                  Критичных warnings в текущем snapshot нет.
                </div>
              )}
            </SectionCard>
          </section>

          {actionResult ? (
            <SectionCard
              title="Последний action result"
              eyebrow="Live feedback"
              description="Ответ последнего действия с settings page. Здесь удобно смотреть диагностику providers и эффект от refresh cache."
            >
              <div className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
                  <p className="font-medium text-white">{actionResult.message}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                    Action: {actionResult.action}
                  </p>
                </div>

                {actionResult.diagnostics ? (
                  <div className="grid gap-4 lg:grid-cols-3">
                    {actionResult.diagnostics.map((item) => (
                      <div key={item.provider} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-white">{item.provider}</p>
                          <span
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.18em]",
                              toneClass(item.tone),
                            )}
                          >
                            {toneLabel(item.tone)}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-300">{item.summary}</p>
                        {item.details.length > 0 ? (
                          <div className="mt-3 space-y-2 text-xs leading-5 text-slate-400">
                            {item.details.map((detail) => (
                              <p key={detail}>{detail}</p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                {actionResult.cacheBefore && actionResult.cacheAfter ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Cache before</p>
                      <p className="mt-3">Entries: {actionResult.cacheBefore.totalEntries}</p>
                      <p className="mt-2">Driver: {actionResult.cacheBefore.driver}</p>
                      <p className="mt-2">Price entries: {actionResult.cacheBefore.priceEntries}</p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Cache after</p>
                      <p className="mt-3">Entries: {actionResult.cacheAfter.totalEntries}</p>
                      <p className="mt-2">Driver: {actionResult.cacheAfter.driver}</p>
                      <p className="mt-2">Price entries: {actionResult.cacheAfter.priceEntries}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </SectionCard>
          ) : null}
        </div>
      </main>

      {toast ? (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-3xl border border-white/10 px-4 py-4 shadow-[0_20px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:bottom-6 sm:right-6">
          <div
            className={
              toast.tone === "success"
                ? "rounded-[20px] border border-emerald-400/20 bg-emerald-400/12 px-4 py-4 text-sm text-emerald-50"
                : "rounded-[20px] border border-rose-400/20 bg-rose-400/12 px-4 py-4 text-sm text-rose-50"
            }
          >
            {toast.message}
          </div>
        </div>
      ) : null}
    </>
  );
}


