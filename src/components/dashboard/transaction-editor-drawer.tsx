"use client";

import { useState } from "react";

import { TRANSACTION_ACTION_OPTIONS } from "@/lib/constants";
import { getLocalDateTimeInputValue } from "@/lib/client/dashboard-client";
import type { AdminTransactionMutationInput } from "@/lib/admin/schema";

type FieldError = {
  path: string;
  message: string;
};

type TransactionEditorDrawerProps = {
  open: boolean;
  canWrite: boolean;
  error: string | null;
  validationErrors: FieldError[];
  isSubmitting: boolean;
  initialData?: Partial<FormState> | null;
  onClose: () => void;
  onSubmit: (payload: AdminTransactionMutationInput) => void;
};

type FormState = {
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

function buildInitialForm(initialData?: Partial<FormState> | null): FormState {
  return {
    date: initialData?.date ?? getLocalDateTimeInputValue(),
    assetType: initialData?.assetType ?? "cs2",
    assetName: initialData?.assetName ?? "",
    action: initialData?.action ?? "buy",
    quantity: initialData?.quantity ?? "",
    price: initialData?.price ?? "",
    fees: initialData?.fees ?? "",
    currency: initialData?.currency ?? "USD",
    notes: initialData?.notes ?? "",
  };
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function TransactionEditorDrawer({
  open,
  canWrite,
  error,
  validationErrors,
  isSubmitting,
  initialData,
  onClose,
  onSubmit,
}: TransactionEditorDrawerProps) {
  const [form, setForm] = useState<FormState>(() => buildInitialForm(initialData));
  const [clientError, setClientError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function submit() {
    setClientError(null);

    const quantity = parseOptionalNumber(form.quantity);
    const price = parseOptionalNumber(form.price);
    const fees = parseOptionalNumber(form.fees);

    if (Number.isNaN(quantity) || Number.isNaN(price) || Number.isNaN(fees)) {
      setClientError("Количество, цена и fees должны быть числами или пустыми значениями.");
      return;
    }

    if (!form.assetName.trim()) {
      setClientError("Укажи название актива для транзакции.");
      return;
    }

    if (!form.date.trim()) {
      setClientError("Укажи дату транзакции.");
      return;
    }

    onSubmit({
      operation: "create",
      entityType: "transaction",
      data: {
        date: form.date,
        assetType: form.assetType,
        assetName: form.assetName.trim(),
        action: form.action,
        quantity,
        price,
        fees,
        currency: form.currency.trim().toUpperCase() || null,
        notes: form.notes.trim() || null,
      },
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/78 backdrop-blur-sm">
      <button type="button" className="flex-1" onClick={onClose} aria-label="Закрыть" />
      <aside className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.98),rgba(4,9,20,0.98))] px-5 py-5 shadow-[0_20px_120px_rgba(0,0,0,0.45)] sm:px-6">
        <div className="flex items-start justify-between gap-4 border-b border-white/8 pb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">Admin mode</p>
            <h3 className="mt-3 text-2xl font-semibold text-white">Добавить транзакцию</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Покупки, продажи, трансферы, price updates и комиссии пишутся в лист Transactions и сразу участвуют в расчете PnL/ROI.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/8"
          >
            Закрыть
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {!canWrite ? (
            <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 px-4 py-4 text-sm leading-6 text-amber-100/90">
              Запись сейчас недоступна. Выдай service account роль Editor и обнови страницу.
            </div>
          ) : null}
          {clientError ? (
            <div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 px-4 py-4 text-sm leading-6 text-rose-100/90">
              {clientError}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 px-4 py-4 text-sm leading-6 text-rose-100/90">
              {error}
            </div>
          ) : null}
          {validationErrors.length > 0 ? (
            <div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 px-4 py-4 text-sm leading-6 text-rose-100/90">
              {validationErrors.map((item) => (
                <p key={`${item.path}:${item.message}`}>
                  {item.path || "payload"}: {item.message}
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 pb-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.24em] text-slate-400">Дата и время</span>
              <input
                type="datetime-local"
                value={form.date}
                onChange={(event) => updateField("date", event.target.value)}
                className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.24em] text-slate-400">Категория</span>
              <select
                value={form.assetType}
                onChange={(event) => updateField("assetType", event.target.value as FormState["assetType"])}
                className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
              >
                <option value="cs2" className="bg-slate-950">CS2</option>
                <option value="telegram" className="bg-slate-950">Подарки Telegram</option>
                <option value="crypto" className="bg-slate-950">Крипта</option>
              </select>
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.24em] text-slate-400">Название актива</span>
            <input
              value={form.assetName}
              onChange={(event) => updateField("assetName", event.target.value)}
              placeholder="Например: Bitcoin, AWP | Dragon Lore, TON Founder Chest"
              className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.24em] text-slate-400">Действие</span>
              <select
                value={form.action}
                onChange={(event) => updateField("action", event.target.value as FormState["action"])}
                className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
              >
                {TRANSACTION_ACTION_OPTIONS.filter((option) => option.value !== "all").map((option) => (
                  <option key={option.value} value={option.value} className="bg-slate-950">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.24em] text-slate-400">Валюта</span>
              <input
                value={form.currency}
                onChange={(event) => updateField("currency", event.target.value.toUpperCase())}
                className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.24em] text-slate-400">Количество</span>
              <input
                value={form.quantity}
                onChange={(event) => updateField("quantity", event.target.value)}
                inputMode="decimal"
                className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.24em] text-slate-400">Цена</span>
              <input
                value={form.price}
                onChange={(event) => updateField("price", event.target.value)}
                inputMode="decimal"
                className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.24em] text-slate-400">Fees</span>
              <input
                value={form.fees}
                onChange={(event) => updateField("fees", event.target.value)}
                inputMode="decimal"
                className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
              />
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.24em] text-slate-400">Заметки</span>
            <textarea
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              rows={5}
              className="w-full rounded-3xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
            />
          </label>
        </div>

        <div className="mt-auto flex flex-col gap-3 border-t border-white/8 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-6 text-slate-400">
            Используй положительное количество для покупок и продаж. Для трансфера можно указать отрицательное число, если актив ушел из портфеля.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/8"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!canWrite || isSubmitting}
              className="rounded-2xl bg-[linear-gradient(135deg,#14d9aa,#377dff)] px-4 py-3 text-sm font-medium text-slate-950 transition hover:opacity-92 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Сохраняю..." : "Создать транзакцию"}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
