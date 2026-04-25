"use client";

import { useEffect, useState } from "react";

import { AllocationChart } from "@/components/dashboard/allocation-chart";
import { AssetClassHistoryChart } from "@/components/dashboard/asset-class-history-chart";
import { CategoryPerformanceChart } from "@/components/dashboard/category-performance-chart";
import { CryptoPanel } from "@/components/dashboard/crypto-panel";
import { Cs2Table } from "@/components/dashboard/cs2-table";
import { Cs2TypeChart } from "@/components/dashboard/cs2-type-chart";
import { PortfolioPnlHistoryChart } from "@/components/dashboard/portfolio-pnl-history-chart";
import { PortfolioValueHistoryChart } from "@/components/dashboard/portfolio-value-history-chart";
import {
  PositionEditorDrawer,
  type AdminEditorState,
} from "@/components/dashboard/position-editor-drawer";
import { SectionCard } from "@/components/dashboard/section-card";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { TelegramGiftsList } from "@/components/dashboard/telegram-gifts-list";
import { TransactionEditorDrawer } from "@/components/dashboard/transaction-editor-drawer";
import { TransactionHistoryTable } from "@/components/dashboard/transaction-history-table";
import type {
  AdminMutationInput,
  AdminTransactionMutationInput,
} from "@/lib/admin/schema";
import { CATEGORY_META } from "@/lib/constants";
import { formatCs2TypeLabel, formatLiquidityLabel } from "@/lib/presentation";
import {
  formatCompactNumber,
  formatCurrency,
  formatPercent,
  formatRelativeTime,
} from "@/lib/utils";
import type {
  Cs2Position,
  PortfolioSnapshot,
  TelegramGiftPosition,
  TopHolding,
} from "@/types/portfolio";

type DashboardShellProps = {
  snapshot: PortfolioSnapshot;
};

type AdminMeta = {
  enabled: boolean;
  canWrite: boolean;
  missingEditorAccess: boolean;
  mode: "native_sheet" | "drive_workbook" | "unavailable";
  fileName: string | null;
  message: string | null;
};

type ValidationError = {
  path: string;
  message: string;
};

type SnapshotConflictBody = {
  error?: string;
  code?: string;
  conflict?: {
    date: string;
    rowNumber: number;
    sheetName: string;
  };
};

type TransactionDrawerPrefill = {
  date: string;
  assetType: "cs2" | "telegram" | "crypto";
  assetName: string;
  action: "buy" | "sell" | "transfer" | "price_update" | "fee";
  quantity: string;
  price: string;
  fees: string;
  currency: string;
  notes: string;
};

function HoldingsList({ holdings, currency }: { holdings: TopHolding[]; currency: string }) {
  if (holdings.length === 0) {
    return <p className="text-sm text-slate-400">Пока нет оцененных позиций для этого блока.</p>;
  }

  return (
    <div className="space-y-3">
      {holdings.map((holding, index) => (
        <div
          key={holding.id}
          className="flex items-center justify-between gap-3 rounded-3xl border border-white/8 bg-white/5 px-4 py-4"
        >
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/6 text-xs text-slate-300">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium text-white">{holding.name}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                {CATEGORY_META[holding.category].label}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-medium text-white">{formatCurrency(holding.value, currency)}</p>
            <p className="mt-1 text-xs text-slate-400">{formatPercent(holding.weight)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Cs2MiniList({
  positions,
  currency,
  mode,
}: {
  positions: Cs2Position[];
  currency: string;
  mode: "value" | "risk";
}) {
  if (positions.length === 0) {
    return <p className="text-sm text-slate-400">Для этого блока пока нет данных.</p>;
  }

  return (
    <div className="space-y-3">
      {positions.map((position) => (
        <div
          key={position.id}
          className="flex items-center justify-between gap-3 rounded-3xl border border-white/8 bg-white/5 px-4 py-4"
        >
          <div className="min-w-0">
            <p className="truncate font-medium text-white">{position.name}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
              {formatCs2TypeLabel(position.type)}
            </p>
          </div>
          <div className="text-right">
            {mode === "value" ? (
              <>
                <p className="font-medium text-white">{formatCurrency(position.totalValue, currency)}</p>
                <p className="mt-1 text-xs text-slate-400">{formatCompactNumber(position.quantity)} шт.</p>
              </>
            ) : (
              <>
                <p className="font-medium text-white">Риск {position.riskScore}</p>
                <p className="mt-1 text-xs text-slate-400">{formatLiquidityLabel(position.liquidityLabel)} ликвидность</p>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function getDashboardTokenFromUrl() {
  if (typeof window === "undefined") {
    return null;
  }

  return new URLSearchParams(window.location.search).get("token");
}

function getAdminModeLabel(mode: AdminMeta["mode"]) {
  if (mode === "native_sheet") {
    return "Нативная Google Sheet";
  }

  if (mode === "drive_workbook") {
    return "Drive workbook / Excel";
  }

  return "Недоступно";
}

function buildDefaultDateValue() {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function getLocalDateKey() {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

function formatSnapshotDate(value: string | null) {
  if (!value) {
    return "Snapshot еще не записан";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function buildTelegramPriceUpdatePrefill(
  position: TelegramGiftPosition,
  currency: string,
): TransactionDrawerPrefill {
  return {
    date: buildDefaultDateValue(),
    assetType: "telegram",
    assetName: position.name,
    action: "price_update",
    quantity: "",
    price: position.estimatedPrice !== null ? String(position.estimatedPrice) : "",
    fees: "",
    currency,
    notes: `Price update для ${position.name}`,
  };
}

export function DashboardShell({ snapshot }: DashboardShellProps) {
  const [currentSnapshot, setCurrentSnapshot] = useState(snapshot);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingPosition, setIsSavingPosition] = useState(false);
  const [isSavingTransaction, setIsSavingTransaction] = useState(false);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [adminMeta, setAdminMeta] = useState<AdminMeta | null>(null);
  const [editorState, setEditorState] = useState<AdminEditorState | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [editorValidationErrors, setEditorValidationErrors] = useState<ValidationError[]>([]);
  const [isTransactionDrawerOpen, setIsTransactionDrawerOpen] = useState(false);
  const [transactionPrefill, setTransactionPrefill] = useState<TransactionDrawerPrefill | null>(null);
  const [transactionDrawerRevision, setTransactionDrawerRevision] = useState(0);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [transactionValidationErrors, setTransactionValidationErrors] = useState<ValidationError[]>([]);
  const [toast, setToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const currency = currentSnapshot.settings.currency ?? "USD";
  const adminReady = isAdminMode && Boolean(adminMeta?.canWrite);
  const lastSnapshotLabel = formatSnapshotDate(currentSnapshot.history.lastSnapshotDate);

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

  async function loadAdminMeta() {
    setIsAdminLoading(true);

    try {
      const response = await dashboardFetch("/api/private/admin/meta");
      const payload = (await response.json().catch(() => null)) as { admin?: AdminMeta; error?: string } | null;

      if (!response.ok || !payload?.admin) {
        throw new Error(payload?.error ?? "Не удалось загрузить статус admin mode.");
      }

      setAdminMeta(payload.admin);
    } catch (error) {
      setAdminMeta({
        enabled: false,
        canWrite: false,
        missingEditorAccess: false,
        mode: "unavailable",
        fileName: null,
        message: error instanceof Error ? error.message : "Не удалось загрузить admin mode.",
      });
    } finally {
      setIsAdminLoading(false);
    }
  }

  async function refreshSnapshot() {
    setIsRefreshing(true);

    try {
      const response = await dashboardFetch("/api/private/portfolio");
      const payload = (await response.json().catch(() => null)) as PortfolioSnapshot | { error?: string } | null;

      if (!response.ok || !payload || !("summary" in payload)) {
        throw new Error((payload as { error?: string } | null)?.error ?? "Не удалось обновить snapshot.");
      }

      setCurrentSnapshot(payload);
    } catch (error) {
      setToast({
        tone: "error",
        message: error instanceof Error ? error.message : "Не удалось обновить dashboard.",
      });
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleAdminToggle() {
    const next = !isAdminMode;
    setIsAdminMode(next);

    if (next && !adminMeta && !isAdminLoading) {
      await loadAdminMeta();
    }
  }

  function openPositionEditor(state: AdminEditorState) {
    toggleTransactionDrawer(false);
    setTransactionPrefill(null);
    setTransactionError(null);
    setTransactionValidationErrors([]);
    setEditorError(null);
    setEditorValidationErrors([]);
    setEditorState(state);
  }

  function toggleTransactionDrawer(open: boolean) {
    setIsTransactionDrawerOpen(open);
    if (open) {
      setEditorState(null);
      setEditorError(null);
      setEditorValidationErrors([]);
    }
  }

  function openTransactionDrawer(prefill: TransactionDrawerPrefill | null = null) {
    setTransactionPrefill(prefill);
    setTransactionError(null);
    setTransactionValidationErrors([]);
    setTransactionDrawerRevision((current) => current + 1);
    toggleTransactionDrawer(true);
  }
  async function handleEditorSubmit(payload: AdminMutationInput) {
    if (!window.confirm(payload.operation === "create" ? "Создать новую позицию в Google Sheets?" : "Сохранить изменения в Google Sheets?")) {
      return;
    }

    setIsSavingPosition(true);
    setEditorError(null);
    setEditorValidationErrors([]);

    try {
      const response = await dashboardFetch("/api/private/admin/positions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => null)) as
        | { error?: string; details?: ValidationError[] }
        | { ok?: boolean }
        | null;

      if (!response.ok) {
        const errorMessage = body && "error" in body ? body.error : undefined;
        const details = body && "details" in body && Array.isArray(body.details) ? body.details : [];

        setEditorError(errorMessage ?? "Не удалось сохранить изменения.");
        setEditorValidationErrors(details);
        setToast({
          tone: "error",
          message: errorMessage ?? "Не удалось сохранить изменения в Google Sheets.",
        });
        return;
      }

      await refreshSnapshot();
      setEditorState(null);
      setToast({
        tone: "success",
        message: payload.operation === "create" ? "Позиция создана и записана в Google Sheets." : "Изменения сохранены в Google Sheets.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Сетевая ошибка при сохранении.";
      setEditorError(message);
      setToast({
        tone: "error",
        message,
      });
    } finally {
      setIsSavingPosition(false);
    }
  }

  async function handleTransactionSubmit(payload: AdminTransactionMutationInput) {
    if (!window.confirm("Записать новую транзакцию в Google Sheets?")) {
      return;
    }

    setIsSavingTransaction(true);
    setTransactionError(null);
    setTransactionValidationErrors([]);

    try {
      const response = await dashboardFetch("/api/private/admin/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => null)) as
        | { error?: string; details?: ValidationError[] }
        | { ok?: boolean }
        | null;

      if (!response.ok) {
        const errorMessage = body && "error" in body ? body.error : undefined;
        const details = body && "details" in body && Array.isArray(body.details) ? body.details : [];

        setTransactionError(errorMessage ?? "Не удалось записать транзакцию.");
        setTransactionValidationErrors(details);
        setToast({
          tone: "error",
          message: errorMessage ?? "Не удалось записать транзакцию в Google Sheets.",
        });
        return;
      }

      await refreshSnapshot();
      toggleTransactionDrawer(false);
      setTransactionPrefill(null);
      setToast({
        tone: "success",
        message: "Транзакция сохранена и уже участвует в расчетах PnL/ROI.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Сетевая ошибка при сохранении транзакции.";
      setTransactionError(message);
      setToast({
        tone: "error",
        message,
      });
    } finally {
      setIsSavingTransaction(false);
    }
  }

  async function handleCreateSnapshot() {
    if (!window.confirm("Создать daily snapshot и записать его в Portfolio_History?")) {
      return;
    }

    setIsCreatingSnapshot(true);

    async function submitSnapshot(replaceExisting: boolean): Promise<boolean> {
      const response = await dashboardFetch("/api/private/admin/snapshots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          operation: "capture",
          entityType: "portfolio_snapshot",
          data: {
            date: getLocalDateKey(),
            notes: null,
            replaceExisting,
            source: "manual",
          },
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            result?: { operation: "create" | "update"; date: string };
            error?: string;
          }
        | SnapshotConflictBody
        | null;

      if (response.status === 409 && body && "code" in body && body.code === "snapshot_exists") {
        const conflictDate = body.conflict?.date ?? getLocalDateKey();
        const confirmed = window.confirm(
          `Snapshot за ${conflictDate} уже существует. Обновить его текущими значениями?`,
        );

        if (!confirmed) {
          return false;
        }

        return submitSnapshot(true);
      }

      if (!response.ok || !body || !("ok" in body) || !body.ok || !body.result) {
        throw new Error((body && "error" in body ? body.error : undefined) ?? "Не удалось сохранить daily snapshot.");
      }

      await refreshSnapshot();
      setToast({
        tone: "success",
        message:
          body.result.operation === "update"
            ? "Сегодняшний snapshot обновлен в Portfolio_History."
            : "Daily snapshot сохранен в Portfolio_History.",
      });
      return true;
    }

    try {
      await submitSnapshot(false);
    } catch (error) {
      setToast({
        tone: "error",
        message: error instanceof Error ? error.message : "Не удалось записать daily snapshot.",
      });
    } finally {
      setIsCreatingSnapshot(false);
    }
  }

  return (
    <>
      <main className="relative overflow-hidden pb-16">
        <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          <section className="panel relative overflow-hidden rounded-[34px] border border-white/10 px-5 py-6 shadow-[0_30px_100px_rgba(2,8,23,0.72)] sm:px-7 sm:py-7 lg:px-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,209,160,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(61,139,255,0.16),transparent_38%),linear-gradient(120deg,rgba(255,255,255,0.02),transparent_45%)]" />
            <div className="relative grid gap-8 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
              <div className="space-y-5">
                <div className="flex flex-wrap gap-3 text-[0.7rem] uppercase tracking-[0.28em] text-cyan-200/70">
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/8 px-3 py-1.5">
                    Приватный инвестиционный терминал
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-300">
                    {currentSnapshot.summary.sourceLabel}
                  </span>
                  {isRefreshing ? (
                    <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-emerald-100">
                      Обновляю snapshot...
                    </span>
                  ) : null}
                </div>
                <div>
                  <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-5xl xl:text-[3.35rem]">
                    Приватный investment terminal с transaction-driven учетом по CS2, подаркам Telegram и крипте.
                  </h1>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300/82 sm:text-base lg:text-lg">
                    Dashboard считает не только текущую стоимость, но и cost basis, realized/unrealized PnL, ROI и комиссии на основе листа Transactions с fallback на позиции из таблицы.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-slate-300">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                    Обновлено {formatRelativeTime(currentSnapshot.summary.lastUpdatedAt)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                    {currentSnapshot.summary.availableSheets.length} подключенных листа
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                    {currentSnapshot.summary.positionsCount.toLocaleString("ru-RU")} позиций
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                    {currentSnapshot.transactions.items.length.toLocaleString("ru-RU")} транзакций
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                    {currentSnapshot.history.items.length.toLocaleString("ru-RU")} snapshot
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                {currentSnapshot.summary.breakdown.map((item) => (
                  <div
                    key={item.category}
                    className="rounded-[26px] border border-white/10 bg-white/[0.045] p-4 backdrop-blur-sm"
                  >
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{item.label}</p>
                    <p className="mt-3 text-2xl font-semibold text-white sm:text-[2rem]">
                      {formatCurrency(item.value, currency)}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-sm text-slate-300/80">
                      <span>{item.positions} поз.</span>
                      <span>{formatCompactNumber(item.items)} шт.</span>
                    </div>
                    <p className={item.pnl >= 0 ? "mt-3 text-sm text-emerald-300" : "mt-3 text-sm text-rose-300"}>
                      {formatCurrency(item.pnl, currency, 2)} {formatPercent(item.roi)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {currentSnapshot.summary.warnings.length > 0 ? (
              <div className="relative mt-6 rounded-[26px] border border-amber-300/20 bg-amber-300/8 px-5 py-4 text-sm text-amber-100/92">
                <p className="text-xs uppercase tracking-[0.24em] text-amber-200/70">Статус данных</p>
                <div className="mt-3 space-y-2">
                  {currentSnapshot.summary.warnings.slice(0, 4).map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="relative mt-6 rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(8,18,35,0.82),rgba(10,32,52,0.72))] p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Admin mode</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Позиции, transactions и daily snapshots под token-gate</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300/82">
                    Меняй позиции, добавляй сделки, price updates и комиссии прямо из dashboard. Сюда же добавлен ручной daily snapshot в Portfolio_History, чтобы строить графики роста и PnL по времени.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleAdminToggle}
                    className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/16"
                  >
                    {isAdminMode ? "Скрыть admin mode" : "Открыть admin mode"}
                  </button>
                  <button
                    type="button"
                    onClick={() => refreshSnapshot().catch(() => undefined)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/8"
                  >
                    Обновить данные
                  </button>
                </div>
              </div>

              {isAdminMode ? (
                <div className="mt-5 space-y-4">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                    <span className={`rounded-full border px-3 py-1.5 ${adminMeta?.canWrite ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100" : "border-amber-300/25 bg-amber-300/10 text-amber-100"}`}>
                      {isAdminLoading ? "Проверяю права..." : adminMeta?.canWrite ? "Запись разрешена" : "Read-only"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-300">
                      {adminMeta ? getAdminModeLabel(adminMeta.mode) : "Режим документа не определен"}
                    </span>
                    {adminMeta?.fileName ? (
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-300">
                        {adminMeta.fileName}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-300">
                      Последний snapshot: {lastSnapshotLabel}
                    </span>
                  </div>

                  {adminMeta?.message ? (
                    <div className={`rounded-[24px] border px-4 py-4 text-sm leading-6 ${adminMeta.canWrite ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-50" : "border-amber-300/20 bg-amber-300/10 text-amber-100"}`}>
                      {adminMeta.message}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={() => openPositionEditor({ entityType: "cs2", operation: "create" })} disabled={!adminMeta?.canWrite} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-40">
                      + Добавить CS2
                    </button>
                    <button type="button" onClick={() => openPositionEditor({ entityType: "telegram", operation: "create" })} disabled={!adminMeta?.canWrite} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-40">
                      + Добавить Gift
                    </button>
                    <button type="button" onClick={() => openPositionEditor({ entityType: "crypto", operation: "create" })} disabled={!adminMeta?.canWrite} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-40">
                      + Добавить Crypto
                    </button>
                    <button type="button" onClick={() => openTransactionDrawer()} disabled={!adminMeta?.canWrite} className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/16 disabled:cursor-not-allowed disabled:opacity-40">
                      + Добавить транзакцию
                    </button>
                    <button type="button" onClick={() => handleCreateSnapshot().catch(() => undefined)} disabled={!adminMeta?.canWrite || isCreatingSnapshot} className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-300/16 disabled:cursor-not-allowed disabled:opacity-40">
                      {isCreatingSnapshot ? "Создаю snapshot..." : "Создать snapshot сейчас"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {currentSnapshot.summary.cards.map((card) => (
              <SummaryCard key={card.id} card={card} currency={currency} />
            ))}
          </section>
          <section className="grid gap-6 xl:grid-cols-3">
            <SectionCard
              title="Стоимость портфеля по времени"
              eyebrow="Portfolio History"
              description="Кривая общей оценки на основе сохраненных daily snapshots. Если в один день snapshot обновлялся, показывается актуальная версия за эту дату."
              aside={
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-slate-300">
                  {lastSnapshotLabel}
                </div>
              }
            >
              <PortfolioValueHistoryChart
                data={currentSnapshot.charts.portfolioValueHistory}
                currency={currency}
              />
            </SectionCard>
            <SectionCard
              title="Рост по классам активов"
              eyebrow="CS2 / Telegram / Crypto"
              description="Позволяет быстро увидеть, какой блок тянет общий рост портфеля, а какой, наоборот, стагнирует или сжимается."
            >
              <AssetClassHistoryChart data={currentSnapshot.charts.assetClassHistory} currency={currency} />
            </SectionCard>
            <SectionCard
              title="PnL по истории snapshots"
              eyebrow="Performance"
              description="Daily snapshots сохраняют total PnL на дату, поэтому можно отслеживать не только стоимость, но и траекторию доходности во времени."
            >
              <PortfolioPnlHistoryChart data={currentSnapshot.charts.portfolioPnlHistory} currency={currency} />
            </SectionCard>
          </section>

          <section className="grid gap-6 xl:grid-cols-3">
            <SectionCard
              title="Структура портфеля"
              eyebrow="Аллокация"
              description="Доля каждого класса активов в текущей оценке портфеля."
            >
              <AllocationChart data={currentSnapshot.charts.allocation} currency={currency} />
            </SectionCard>
            <SectionCard
              title="Себестоимость vs стоимость"
              eyebrow="По категориям"
              description="Сравнение текущей оценки с известной себестоимостью по каждому блоку."
            >
              <CategoryPerformanceChart
                data={currentSnapshot.charts.categoryPerformance}
                currency={currency}
              />
            </SectionCard>
            <SectionCard
              title="Срез CS2 по типам"
              eyebrow="Композиция инвентаря"
              description="Как текущая стоимость CS2 распределена между наклейками, скинами, кейсами и прочими сегментами."
            >
              <Cs2TypeChart data={currentSnapshot.charts.cs2ByType} currency={currency} />
            </SectionCard>
          </section>

          <section className="grid gap-6 xl:grid-cols-3">
            <SectionCard
              title="Крупнейшие позиции"
              eyebrow="Концентрация"
              description="Топ кросс-категорийных позиций по текущей стоимости."
            >
              <HoldingsList holdings={currentSnapshot.summary.topHoldings} currency={currency} />
            </SectionCard>
            <SectionCard
              title="Топ CS2 по стоимости"
              eyebrow="10 крупнейших"
              description="Самые крупные CS2-позиции по текущей оценке."
            >
              <Cs2MiniList positions={currentSnapshot.cs2.topPositions} currency={currency} mode="value" />
            </SectionCard>
            <SectionCard
              title="Риск и неликвид"
              eyebrow="10 позиций"
              description="Ранжирование по концентрации, ликвидности и полноте ценовых данных."
            >
              <Cs2MiniList positions={currentSnapshot.cs2.riskPositions} currency={currency} mode="risk" />
            </SectionCard>
          </section>

          <SectionCard
            title="Позиции CS2"
            eyebrow="Основной реестр"
            description="Поиск, фильтр и сортировка всех CS2-активов. На мобильном таблица автоматически переходит в карточки."
          >
            <Cs2Table
              positions={currentSnapshot.cs2.positions}
              currency={currency}
              adminEnabled={adminReady}
              onEditPosition={(position) => {
                openPositionEditor({
                  entityType: "cs2",
                  operation: "update",
                  position,
                });
              }}
            />
          </SectionCard>

          <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
            <SectionCard
              title="Подарки Telegram"
              eyebrow="Manual + semi-auto pricing"
              description="Manual price, confidence, source note и last checked date живут прямо в sheet. Для semi-auto сценария подарки можно оценивать через TON c live-конвертацией, а историю price updates вести отдельными транзакциями."
            >
              <TelegramGiftsList
                positions={currentSnapshot.telegramGifts.positions}
                analytics={currentSnapshot.telegramGifts.analytics}
                currency={currency}
                adminEnabled={adminReady}
                onQuickPriceUpdate={(position) => {
                  openTransactionDrawer(buildTelegramPriceUpdatePrefill(position, currency));
                }}
                onEditPosition={(position) => {
                  openPositionEditor({
                    entityType: "telegram",
                    operation: "update",
                    position,
                  });
                }}
              />
            </SectionCard>
            <SectionCard
              title="Крипта"
              eyebrow="Live pricing"
              description="Котировки подтягиваются через CoinGecko, а при недоступности провайдера используется резервная цена из таблицы или последний price update из Transactions."
            >
              <CryptoPanel
                positions={currentSnapshot.crypto.positions}
                currency={currency}
                adminEnabled={adminReady}
                onEditPosition={(position) => {
                  openPositionEditor({
                    entityType: "crypto",
                    operation: "update",
                    position,
                  });
                }}
              />
            </SectionCard>
          </section>

          <SectionCard
            title="История Transactions"
            eyebrow="PnL engine"
            description="Покупки, продажи, трансферы, price updates и комиссии. Эта таблица напрямую управляет average entry, realized/unrealized PnL, ROI и fees."
          >
            <TransactionHistoryTable
              transactions={currentSnapshot.transactions.items}
              currency={currency}
              adminEnabled={adminReady}
              onAddTransaction={() => openTransactionDrawer()}
            />
          </SectionCard>
        </div>
      </main>
      {editorState ? (
        <PositionEditorDrawer
          key={`${editorState.entityType}:${editorState.operation}:${editorState.operation === "update" ? editorState.position.id : "create"}`}
          open
          state={editorState}
          canWrite={Boolean(adminMeta?.canWrite)}
          error={editorError}
          validationErrors={editorValidationErrors}
          isSubmitting={isSavingPosition}
          onClose={() => {
            if (isSavingPosition) {
              return;
            }

            setEditorState(null);
            setEditorError(null);
            setEditorValidationErrors([]);
          }}
          onSubmit={(payload) => {
            handleEditorSubmit(payload).catch(() => undefined);
          }}
        />
      ) : null}

      <TransactionEditorDrawer
        key={transactionDrawerRevision}
        open={isTransactionDrawerOpen}
        initialData={transactionPrefill}
        canWrite={Boolean(adminMeta?.canWrite)}
        error={transactionError}
        validationErrors={transactionValidationErrors}
        isSubmitting={isSavingTransaction}
        onClose={() => {
          if (isSavingTransaction) {
            return;
          }

          toggleTransactionDrawer(false);
          setTransactionPrefill(null);
          setTransactionError(null);
          setTransactionValidationErrors([]);
        }}
        onSubmit={(payload) => {
          handleTransactionSubmit(payload).catch(() => undefined);
        }}
      />

      {toast ? (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-3xl border border-white/10 px-4 py-4 shadow-[0_20px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:bottom-6 sm:right-6">
          <div className={toast.tone === "success" ? "rounded-[20px] border border-emerald-400/20 bg-emerald-400/12 px-4 py-4 text-sm text-emerald-50" : "rounded-[20px] border border-rose-400/20 bg-rose-400/12 px-4 py-4 text-sm text-rose-50"}>
            {toast.message}
          </div>
        </div>
      ) : null}
    </>
  );
}
