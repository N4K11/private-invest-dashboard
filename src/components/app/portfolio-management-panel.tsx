"use client";

import { useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { DashboardStatePanel } from "@/components/dashboard/dashboard-state-panel";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import type {
  SaasPortfolioListItem,
  SaasPortfolioVisibility,
} from "@/types/saas";

const VISIBILITY_OPTIONS: { value: SaasPortfolioVisibility; label: string }[] = [
  { value: "private", label: "Private" },
  { value: "shared_link", label: "Shared link" },
  { value: "workspace", label: "Внутри workspace" },
];

type PortfolioManagementPanelProps = {
  workspaceId: string;
  workspaceName: string;
  defaultCurrency: string;
  canManage: boolean;
  portfolios: SaasPortfolioListItem[];
};

function visibilityLabel(value: SaasPortfolioVisibility) {
  return VISIBILITY_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function PortfolioManagementPanel({
  workspaceId,
  workspaceName,
  defaultCurrency,
  canManage,
  portfolios,
}: PortfolioManagementPanelProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    baseCurrency: defaultCurrency || "USD",
    visibility: "private" as SaasPortfolioVisibility,
    riskProfile: "balanced",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    baseCurrency: defaultCurrency || "USD",
    visibility: "private" as SaasPortfolioVisibility,
    riskProfile: "balanced",
  });
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function beginEdit(portfolio: SaasPortfolioListItem) {
    setEditingId(portfolio.id);
    setFeedback(null);
    setEditForm({
      name: portfolio.name,
      baseCurrency: portfolio.baseCurrency,
      visibility: portfolio.visibility,
      riskProfile: portfolio.riskProfile ?? "balanced",
    });
  }

  function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const response = await fetch("/api/app/portfolios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId,
          ...createForm,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setFeedback({ tone: "error", message: payload?.error ?? "Не удалось создать портфель." });
        return;
      }

      setCreateForm((current) => ({ ...current, name: "" }));
      setFeedback({ tone: "success", message: "Портфель создан." });
      router.refresh();
    });
  }

  function handleUpdate(portfolioId: string) {
    setFeedback(null);

    startTransition(async () => {
      const response = await fetch(`/api/app/portfolios/${portfolioId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editForm),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setFeedback({ tone: "error", message: payload?.error ?? "Не удалось обновить портфель." });
        return;
      }

      setEditingId(null);
      setFeedback({ tone: "success", message: "Параметры портфеля сохранены." });
      router.refresh();
    });
  }

  function handleArchive(portfolioId: string, portfolioName: string) {
    if (!window.confirm(`Архивировать портфель «${portfolioName}»?`)) {
      return;
    }

    setFeedback(null);

    startTransition(async () => {
      const response = await fetch(`/api/app/portfolios/${portfolioId}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setFeedback({ tone: "error", message: payload?.error ?? "Не удалось архивировать портфель." });
        return;
      }

      if (editingId === portfolioId) {
        setEditingId(null);
      }

      setFeedback({ tone: "success", message: "Портфель архивирован." });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="panel rounded-[30px] border border-white/10 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[0.68rem] uppercase tracking-[0.32em] text-cyan-200/65">
              Управление портфелями
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-white">
              {workspaceName}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300/78">
              Создавайте отдельные портфели под разные стратегии, валюты и уровни доступа. Настройки visibility, base currency и risk profile редактируются прямо здесь.
            </p>
          </div>
          {!canManage ? (
            <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
              У вас только просмотр. Создание и редактирование доступны ролям owner/admin.
            </div>
          ) : null}
        </div>

        {canManage ? (
          <form className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.7fr_0.7fr_0.8fr_auto]" onSubmit={handleCreateSubmit}>
            <input
              value={createForm.name}
              onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
              disabled={isPending}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
              placeholder="Название нового портфеля"
            />
            <input
              value={createForm.baseCurrency}
              onChange={(event) => setCreateForm((current) => ({ ...current, baseCurrency: event.target.value.toUpperCase() }))}
              disabled={isPending}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
              placeholder="USD"
            />
            <select
              value={createForm.visibility}
              onChange={(event) => setCreateForm((current) => ({ ...current, visibility: event.target.value as SaasPortfolioVisibility }))}
              disabled={isPending}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-300/60"
            >
              {VISIBILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              value={createForm.riskProfile}
              onChange={(event) => setCreateForm((current) => ({ ...current, riskProfile: event.target.value }))}
              disabled={isPending}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
              placeholder="balanced"
            />
            <button
              type="submit"
              disabled={isPending}
              className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Сохраняю..." : "Создать"}
            </button>
          </form>
        ) : null}

        {feedback ? (
          <div
            className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
              feedback.tone === "error"
                ? "border border-rose-400/30 bg-rose-400/10 text-rose-100"
                : "border border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
            }`}
          >
            {feedback.message}
          </div>
        ) : null}
      </section>

      {portfolios.length === 0 ? (
        <DashboardStatePanel
          eyebrow="Портфели не найдены"
          title="В этом workspace пока нет портфелей"
          description="Создайте первый портфель, чтобы затем подключать импорт, интеграции и детальные аналитические экраны."
          tone="neutral"
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {portfolios.map((portfolio) => {
            const isEditing = editingId === portfolio.id;

            return (
              <article
                key={portfolio.id}
                className="panel rounded-[28px] border border-white/10 px-5 py-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-xl font-semibold text-white">{portfolio.name}</h4>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300/75">
                        {visibilityLabel(portfolio.visibility)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      slug: {portfolio.slug} · risk profile: {portfolio.riskProfile ?? "balanced"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/app/portfolios/${portfolio.id}`}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:text-white"
                    >
                      Открыть
                    </Link>
                    {canManage ? (
                      <>
                        <button
                          type="button"
                          onClick={() => beginEdit(portfolio)}
                          className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100 transition hover:border-cyan-300/40"
                        >
                          Редактировать
                        </button>
                        <button
                          type="button"
                          onClick={() => handleArchive(portfolio.id, portfolio.name)}
                          className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-2 text-sm text-rose-100 transition hover:border-rose-400/40"
                        >
                          Архивировать
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Value</p>
                    <p className="mt-2 text-lg font-medium text-white">
                      {formatCurrency(portfolio.totalValue, portfolio.baseCurrency)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">PnL</p>
                    <p className={`mt-2 text-lg font-medium ${portfolio.totalPnl >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                      {formatCurrency(portfolio.totalPnl, portfolio.baseCurrency)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Состав</p>
                    <p className="mt-2 text-lg font-medium text-white">
                      {portfolio.positionCount} позиций · {portfolio.transactionCount} транзакций
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Интеграции</p>
                    <p className="mt-2 text-lg font-medium text-white">
                      {portfolio.integrationCount}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
                  {portfolio.categories.length > 0 ? (
                    portfolio.categories.map((category) => (
                      <span key={`${portfolio.id}-${category}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 uppercase tracking-[0.18em] text-slate-300/80">
                        {category}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full border border-dashed border-white/10 px-3 py-1 uppercase tracking-[0.18em]">
                      Без категорий
                    </span>
                  )}
                  <span className="ml-auto">Обновлен {formatRelativeTime(portfolio.updatedAt)}</span>
                </div>

                {isEditing ? (
                  <div className="mt-5 grid gap-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 lg:grid-cols-[1.2fr_0.7fr_0.7fr_0.8fr_auto]">
                    <input
                      value={editForm.name}
                      onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                      disabled={isPending}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                    />
                    <input
                      value={editForm.baseCurrency}
                      onChange={(event) => setEditForm((current) => ({ ...current, baseCurrency: event.target.value.toUpperCase() }))}
                      disabled={isPending}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                    />
                    <select
                      value={editForm.visibility}
                      onChange={(event) => setEditForm((current) => ({ ...current, visibility: event.target.value as SaasPortfolioVisibility }))}
                      disabled={isPending}
                      className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-300/60"
                    >
                      {VISIBILITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      value={editForm.riskProfile}
                      onChange={(event) => setEditForm((current) => ({ ...current, riskProfile: event.target.value }))}
                      disabled={isPending}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdate(portfolio.id)}
                        disabled={isPending}
                        className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Сохранить
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-white/20 hover:text-white"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
