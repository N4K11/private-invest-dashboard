"use client";

import { useState, type ReactNode } from "react";

import {
  ADMIN_STATUS_OPTIONS,
  CS2_TYPE_OPTIONS,
  TELEGRAM_PRICE_CONFIDENCE_OPTIONS,
} from "@/lib/constants";
import type { AdminMutationInput } from "@/lib/admin/schema";
import type {
  CryptoPosition,
  Cs2Position,
  SheetRowRef,
  TelegramGiftPosition,
} from "@/types/portfolio";

type FieldError = {
  path: string;
  message: string;
};

type Cs2EditorState =
  | { entityType: "cs2"; operation: "create" }
  | { entityType: "cs2"; operation: "update"; position: Cs2Position };

type TelegramEditorState =
  | { entityType: "telegram"; operation: "create" }
  | { entityType: "telegram"; operation: "update"; position: TelegramGiftPosition };

type CryptoEditorState =
  | { entityType: "crypto"; operation: "create" }
  | { entityType: "crypto"; operation: "update"; position: CryptoPosition };

export type AdminEditorState = Cs2EditorState | TelegramEditorState | CryptoEditorState;

type PositionEditorDrawerProps = {
  state: AdminEditorState | null;
  open: boolean;
  canWrite: boolean;
  error: string | null;
  validationErrors: FieldError[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: AdminMutationInput) => void;
};

type FormState = Record<string, string>;

type Cs2AdminAssetType = "stickers" | "skins" | "cases" | "charms" | "graffiti" | "other";

function numberToInput(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseQuantity(value: string) {
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function buildInitialForm(state: AdminEditorState | null): FormState {
  if (!state) {
    return {};
  }

  if (state.entityType === "cs2") {
    const position = state.operation === "update" ? state.position : null;

    return {
      name: position?.name ?? "",
      assetType: position?.type ?? "skins",
      category: position?.category ?? "",
      quantity: numberToInput(position?.quantity ?? 1),
      entryPrice: numberToInput(position?.averageEntryPrice),
      manualCurrentPrice: numberToInput(position?.manualCurrentPrice),
      status: position?.status ?? "hold",
      notes: position?.notes ?? "",
    };
  }

  if (state.entityType === "telegram") {
    const position = state.operation === "update" ? state.position : null;

    return {
      name: position?.name ?? "",
      collection: position?.collection ?? "",
      quantity: numberToInput(position?.quantity ?? 1),
      entryPrice: numberToInput(position?.entryPrice),
      manualCurrentPrice: numberToInput(position?.manualCurrentPrice),
      priceConfidence: position?.priceConfidence ?? "medium",
      liquidityNote: position?.liquidityNote ?? "",
      status: position?.status ?? "hold",
      notes: position?.notes ?? "",
    };
  }

  const position = state.operation === "update" ? state.position : null;
  return {
    symbol: position?.symbol ?? "BTC",
    name: position?.name ?? "",
    quantity: numberToInput(position?.quantity ?? 0.01),
    entryPrice: numberToInput(position?.averageEntryPrice),
    manualCurrentPrice: numberToInput(position?.manualCurrentPrice),
    walletNote: position?.walletNote ?? "",
    status: position?.status ?? "hold",
    notes: position?.notes ?? "",
  };
}

function getRowRef(state: AdminEditorState): SheetRowRef | null {
  if (state.operation !== "update") {
    return null;
  }

  return state.position.rowRef;
}

function getTitle(state: AdminEditorState | null) {
  if (!state) {
    return "";
  }

  const subject =
    state.entityType === "cs2"
      ? "CS2-позицию"
      : state.entityType === "telegram"
        ? "подарок Telegram"
        : "крипто-позицию";

  return state.operation === "create" ? `Добавить ${subject}` : `Редактировать ${subject}`;
}

function getSubmitLabel(state: AdminEditorState | null, isSubmitting: boolean) {
  if (isSubmitting) {
    return "Сохраняю...";
  }

  if (!state) {
    return "Сохранить";
  }

  return state.operation === "create" ? "Создать позицию" : "Сохранить изменения";
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</span>
      {children}
    </label>
  );
}

export function PositionEditorDrawer({
  state,
  open,
  canWrite,
  error,
  validationErrors,
  isSubmitting,
  onClose,
  onSubmit,
}: PositionEditorDrawerProps) {
  const [form, setForm] = useState<FormState>(() => buildInitialForm(state));
  const [clientError, setClientError] = useState<string | null>(null);

  if (!open || !state) {
    return null;
  }

  const activeState = state;

  function updateField(key: string, value: string) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function submit() {
    setClientError(null);

    const quantity = parseQuantity(form.quantity ?? "");
    if (!Number.isFinite(quantity) || quantity < 0) {
      setClientError("Количество должно быть неотрицательным числом.");
      return;
    }

    if (activeState.operation === "update" && !getRowRef(activeState)) {
      setClientError("Для этой позиции не найден row reference. Обнови snapshot и попробуй снова.");
      return;
    }

    if (activeState.entityType === "cs2") {
      const entryPrice = parseOptionalNumber(form.entryPrice ?? "");
      const manualCurrentPrice = parseOptionalNumber(form.manualCurrentPrice ?? "");

      if (Number.isNaN(entryPrice) || Number.isNaN(manualCurrentPrice)) {
        setClientError("Цены должны быть числами или пустыми значениями.");
        return;
      }

      const data = {
        name: (form.name ?? "").trim(),
        assetType: (form.assetType ?? "other") as Cs2AdminAssetType,
        category: (form.category ?? "").trim() || null,
        quantity,
        entryPrice,
        manualCurrentPrice,
        status: (form.status ?? "hold").trim() || "hold",
        notes: (form.notes ?? "").trim() || null,
      };

      if (!data.name) {
        setClientError("Название CS2-позиции обязательно.");
        return;
      }

      if (activeState.operation === "create") {
        onSubmit({
          operation: "create",
          entityType: "cs2",
          data,
        });
        return;
      }

      onSubmit({
        operation: "update",
        entityType: "cs2",
        id: activeState.position.id,
        rowRef: activeState.position.rowRef!,
        data,
      });
      return;
    }

    if (activeState.entityType === "telegram") {
      const entryPrice = parseOptionalNumber(form.entryPrice ?? "");
      const manualCurrentPrice = parseOptionalNumber(form.manualCurrentPrice ?? "");

      if (Number.isNaN(entryPrice) || Number.isNaN(manualCurrentPrice)) {
        setClientError("Цены должны быть числами или пустыми значениями.");
        return;
      }

      const data = {
        name: (form.name ?? "").trim(),
        collection: (form.collection ?? "").trim() || null,
        quantity,
        entryPrice,
        manualCurrentPrice,
        priceConfidence: ((form.priceConfidence ?? "medium").trim() || null) as "low" | "medium" | "high" | null,
        liquidityNote: (form.liquidityNote ?? "").trim() || null,
        status: (form.status ?? "hold").trim() || "hold",
        notes: (form.notes ?? "").trim() || null,
      };

      if (!data.name) {
        setClientError("Название подарка обязательно.");
        return;
      }

      if (activeState.operation === "create") {
        onSubmit({
          operation: "create",
          entityType: "telegram",
          data,
        });
        return;
      }

      onSubmit({
        operation: "update",
        entityType: "telegram",
        id: activeState.position.id,
        rowRef: activeState.position.rowRef!,
        data,
      });
      return;
    }

    const entryPrice = parseOptionalNumber(form.entryPrice ?? "");
    const manualCurrentPrice = parseOptionalNumber(form.manualCurrentPrice ?? "");

    if (Number.isNaN(entryPrice) || Number.isNaN(manualCurrentPrice)) {
      setClientError("Цены должны быть числами или пустыми значениями.");
      return;
    }

    const data = {
      symbol: (form.symbol ?? "").trim().toUpperCase(),
      name: (form.name ?? "").trim(),
      quantity,
      entryPrice,
      manualCurrentPrice,
      walletNote: (form.walletNote ?? "").trim() || null,
      status: (form.status ?? "hold").trim() || "hold",
      notes: (form.notes ?? "").trim() || null,
    };

    if (!data.symbol || !data.name) {
      setClientError("Для крипто-позиции нужны symbol и name.");
      return;
    }

    if (activeState.operation === "create") {
      onSubmit({
        operation: "create",
        entityType: "crypto",
        data,
      });
      return;
    }

    onSubmit({
      operation: "update",
      entityType: "crypto",
      id: activeState.position.id,
      rowRef: activeState.position.rowRef!,
      data,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/78 backdrop-blur-sm">
      <button type="button" className="flex-1" onClick={onClose} aria-label="Закрыть" />
      <aside className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.98),rgba(4,9,20,0.98))] px-5 py-5 shadow-[0_20px_120px_rgba(0,0,0,0.45)] sm:px-6">
        <div className="flex items-start justify-between gap-4 border-b border-white/8 pb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">Admin mode</p>
            <h3 className="mt-3 text-2xl font-semibold text-white">{getTitle(activeState)}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Изменения будут записаны обратно в Google Sheets и продублированы в Audit_Log.
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
          {activeState.entityType === "cs2" ? (
            <>
              <Field label="Название">
                <input value={form.name ?? ""} onChange={(event) => updateField("name", event.target.value)} className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Тип">
                  <select value={form.assetType ?? "other"} onChange={(event) => updateField("assetType", event.target.value)} className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50">
                    {CS2_TYPE_OPTIONS.filter((option) => option.value !== "all").map((option) => (
                      <option key={option.value} value={option.value} className="bg-slate-950">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Категория">
                  <input value={form.category ?? ""} onChange={(event) => updateField("category", event.target.value)} className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50" />
                </Field>
              </div>
            </>
          ) : null}

          {activeState.entityType === "telegram" ? (
            <>
              <Field label="Название подарка">
                <input value={form.name ?? ""} onChange={(event) => updateField("name", event.target.value)} className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50" />
              </Field>
              <Field label="Коллекция">
                <input value={form.collection ?? ""} onChange={(event) => updateField("collection", event.target.value)} className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50" />
              </Field>
            </>
          ) : null}

          {activeState.entityType === "crypto" ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Symbol">
                  <input value={form.symbol ?? ""} onChange={(event) => updateField("symbol", event.target.value.toUpperCase())} className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50" />
                </Field>
                <Field label="Название">
                  <input value={form.name ?? ""} onChange={(event) => updateField("name", event.target.value)} className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50" />
                </Field>
              </div>
              <Field label="Wallet note">
                <input value={form.walletNote ?? ""} onChange={(event) => updateField("walletNote", event.target.value)} className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50" />
              </Field>
            </>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Количество">
              <input value={form.quantity ?? ""} onChange={(event) => updateField("quantity", event.target.value)} inputMode="decimal" className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50" />
            </Field>
            <Field label="Цена входа">
              <input value={form.entryPrice ?? ""} onChange={(event) => updateField("entryPrice", event.target.value)} inputMode="decimal" className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50" />
            </Field>
            <Field label="Ручная текущая цена">
              <input value={form.manualCurrentPrice ?? ""} onChange={(event) => updateField("manualCurrentPrice", event.target.value)} inputMode="decimal" className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50" />
            </Field>
          </div>

          {activeState.entityType === "telegram" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Уверенность в цене">
                <select value={form.priceConfidence ?? "medium"} onChange={(event) => updateField("priceConfidence", event.target.value)} className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50">
                  {TELEGRAM_PRICE_CONFIDENCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} className="bg-slate-950">
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Ликвидность / note">
                <input value={form.liquidityNote ?? ""} onChange={(event) => updateField("liquidityNote", event.target.value)} className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50" />
              </Field>
            </div>
          ) : null}

          <Field label="Статус">
            <select value={form.status ?? "hold"} onChange={(event) => updateField("status", event.target.value)} className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50">
              {ADMIN_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-slate-950">
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Заметки">
            <textarea value={form.notes ?? ""} onChange={(event) => updateField("notes", event.target.value)} rows={5} className="w-full rounded-3xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50" />
          </Field>
        </div>

        <div className="mt-auto flex flex-col gap-3 border-t border-white/8 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-6 text-slate-400">
            Перед записью dashboard попросит подтверждение. Позиции не удаляются физически, для скрытия используй статусы archived или dead.
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/8">
              Отмена
            </button>
            <button type="button" onClick={submit} disabled={!canWrite || isSubmitting} className="rounded-2xl bg-[linear-gradient(135deg,#14d9aa,#377dff)] px-4 py-3 text-sm font-medium text-slate-950 transition hover:opacity-92 disabled:cursor-not-allowed disabled:opacity-50">
              {getSubmitLabel(activeState, isSubmitting)}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

