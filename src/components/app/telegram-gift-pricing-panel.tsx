"use client";

import { useMemo, useState, useTransition } from "react";
import type { FormEvent } from "react";

import { useRouter } from "next/navigation";

import { DashboardStatePanel } from "@/components/dashboard/dashboard-state-panel";
import {
  formatSaasPriceConfidenceLabel,
  formatTelegramPriceSourceLabel,
} from "@/lib/presentation";
import {
  cn,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRelativeTime,
} from "@/lib/utils";
import type {
  SaasManualAssetConfidence,
  SaasPortfolioDetail,
  SaasTelegramGiftPricingRow,
  SaasTelegramPriceSource,
} from "@/types/saas";

const PRICE_SOURCE_OPTIONS: { value: SaasTelegramPriceSource; label: string }[] = [
  { value: "fragment", label: "Fragment" },
  { value: "otc_deal", label: "OTC deal" },
  { value: "marketplace_listing", label: "Marketplace listing" },
  { value: "manual_estimate", label: "Manual estimate" },
];

const CONFIDENCE_OPTIONS: { value: SaasManualAssetConfidence; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

type TelegramGiftPricingPanelProps = {
  portfolioId: string;
  baseCurrency: string;
  canManage: boolean;
  telegramPricing: SaasPortfolioDetail["telegramPricing"];
};

type FormState = {
  price: string;
  currency: string;
  confidence: SaasManualAssetConfidence;
  priceSource: SaasTelegramPriceSource;
  lastVerifiedAt: string;
  notes: string;
};

function toDateTimeLocalValue(value: string | null) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const localTime = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 16);
}

function createFormState(gift: SaasTelegramGiftPricingRow, baseCurrency: string): FormState {
  return {
    price: gift.currentPrice !== null ? String(gift.currentPrice) : "",
    currency: gift.currency || baseCurrency,
    confidence: gift.confidence ?? "medium",
    priceSource: gift.priceSource ?? "manual_estimate",
    lastVerifiedAt: toDateTimeLocalValue(gift.lastVerifiedAt) || toDateTimeLocalValue(new Date().toISOString()),
    notes: gift.notes ?? "",
  };
}

function getConfidenceTone(confidence: SaasManualAssetConfidence | null) {
  switch (confidence) {
    case "high":
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
    case "medium":
      return "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";
    case "low":
      return "border-amber-300/25 bg-amber-300/10 text-amber-100";
    default:
      return "border-white/10 bg-white/5 text-slate-300";
  }
}

export function TelegramGiftPricingPanel({
  portfolioId,
  baseCurrency,
  canManage,
  telegramPricing,
}: TelegramGiftPricingPanelProps) {
  const router = useRouter();
  const [selectedGift, setSelectedGift] = useState<SaasTelegramGiftPricingRow | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const summary = useMemo(
    () => [
      {
        label: "Gift positions",
        value: formatNumber(telegramPricing.positionCount, 0),
      },
      {
        label: "Telegram value",
        value: formatCurrency(telegramPricing.totalValue, baseCurrency),
      },
      {
        label: "Need review",
        value: formatNumber(telegramPricing.staleCount, 0),
      },
      {
        label: "Outliers",
        value: formatNumber(telegramPricing.outlierCount, 0),
      },
    ],
    [baseCurrency, telegramPricing.outlierCount, telegramPricing.positionCount, telegramPricing.staleCount, telegramPricing.totalValue],
  );

  function closeDrawer() {
    setSelectedGift(null);
    setForm(null);
  }

  function openDrawer(gift: SaasTelegramGiftPricingRow) {
    setFeedback(null);
    setSelectedGift(gift);
    setForm(createFormState(gift, baseCurrency));
  }

  function submitPriceUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedGift || !form) {
      return;
    }

    const price = Number(form.price);
    if (!Number.isFinite(price) || price <= 0) {
      setFeedback({ tone: "error", message: "Введите корректную цену Telegram Gift." });
      return;
    }

    const verifiedAt = new Date(form.lastVerifiedAt);
    if (!form.lastVerifiedAt || Number.isNaN(verifiedAt.getTime())) {
      setFeedback({ tone: "error", message: "Укажите корректную дату проверки price quote." });
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      const response = await fetch(
        `/api/app/portfolios/${portfolioId}/positions/${selectedGift.positionId}/telegram-price`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            price,
            currency: form.currency.trim().toUpperCase(),
            confidence: form.confidence,
            priceSource: form.priceSource,
            lastVerifiedAt: verifiedAt.toISOString(),
            notes: form.notes.trim() || null,
          }),
        },
      );

      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            result?: {
              isOutlier?: boolean;
              outlierMessage?: string | null;
            };
          }
        | null;

      if (!response.ok) {
        setFeedback({
          tone: "error",
          message: payload?.error ?? "Не удалось обновить цену Telegram Gift.",
        });
        return;
      }

      setFeedback({
        tone: "success",
        message:
          payload?.result?.isOutlier && payload.result.outlierMessage
            ? `Цена обновлена. ${payload.result.outlierMessage}`
            : "Цена Telegram Gift обновлена.",
      });
      closeDrawer();
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {feedback ? (
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm",
            feedback.tone === "error"
              ? "border border-rose-400/30 bg-rose-400/10 text-rose-100"
              : "border border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
          )}
        >
          {feedback.message}
        </div>
      ) : null}

      {telegramPricing.positionCount === 0 ? (
        <DashboardStatePanel
          eyebrow="Telegram pricing"
          title="Telegram Gifts пока не добавлены"
          description="Как только в портфеле появятся Telegram Gifts, здесь появятся OTC quotes, история price updates и review reminders."
          className="min-h-[260px]"
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summary.map((item) => (
              <div
                key={item.label}
                className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                <p className="mt-3 text-xl font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            {telegramPricing.gifts.map((gift) => (
              <article
                key={gift.positionId}
                className="rounded-[28px] border border-white/10 bg-white/[0.03] px-4 py-4 sm:px-5"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-white">{gift.assetName}</h3>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.7rem] uppercase tracking-[0.18em] text-slate-300/80">
                        qty {formatNumber(gift.quantity, 4)}
                      </span>
                      <span
                        className={cn(
                          "rounded-full border px-3 py-1 text-[0.7rem] uppercase tracking-[0.18em]",
                          getConfidenceTone(gift.confidence),
                        )}
                      >
                        {gift.confidence ?? "unknown"}
                      </span>
                      {gift.priceSource ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.7rem] uppercase tracking-[0.18em] text-slate-300/80">
                          {formatTelegramPriceSourceLabel(gift.priceSource)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm text-slate-300/78">
                      Текущая оценка: {gift.currentPrice !== null ? formatCurrency(gift.currentPrice, gift.currency, 2) : "—"}
                      {" · "}
                      total {formatCurrency(gift.totalValue, baseCurrency)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300/75">
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                        Проверено: {gift.lastVerifiedAt ? formatRelativeTime(gift.lastVerifiedAt) : "не указано"}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                        Confidence: {gift.confidence ? formatSaasPriceConfidenceLabel(gift.confidence === "low" ? "manual_low" : "manual_high") : "Нет оценки"}
                      </span>
                    </div>
                  </div>

                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => openDrawer(gift)}
                      className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                    >
                      Обновить цену
                    </button>
                  ) : null}
                </div>

                {gift.needsReview ? (
                  <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-4 text-sm leading-7 text-amber-50/90">
                    <span className="font-semibold">Нужен review: </span>
                    {gift.reviewReason}
                  </div>
                ) : null}

                {gift.latestOutlierMessage ? (
                  <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-4 text-sm leading-7 text-rose-50/90">
                    <span className="font-semibold">Outlier warning: </span>
                    {gift.latestOutlierMessage}
                  </div>
                ) : null}

                {gift.notes ? (
                  <p className="mt-4 text-sm leading-7 text-slate-300/78">{gift.notes}</p>
                ) : null}

                <div className="mt-5 grid gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300/72">
                      История price updates
                    </h4>
                    <span className="text-xs text-slate-500">{gift.history.length} записей</span>
                  </div>

                  {gift.history.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-400">
                      История еще пустая. Первый price update создаст `PRICE_UPDATE` событие и станет точкой отсчета для outlier detection.
                    </div>
                  ) : (
                    gift.history.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-base font-semibold text-white">
                                {entry.price !== null && entry.currency
                                  ? formatCurrency(entry.price, entry.currency, 2)
                                  : "—"}
                              </span>
                              {entry.changePercent !== null ? (
                                <span className={cn(
                                  "rounded-full border px-3 py-1 text-[0.7rem] uppercase tracking-[0.18em]",
                                  entry.changePercent >= 0
                                    ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
                                    : "border-rose-400/25 bg-rose-400/10 text-rose-100",
                                )}>
                                  {formatPercent(entry.changePercent, 1)}
                                </span>
                              ) : null}
                              {entry.priceSource ? (
                                <span className="rounded-full border border-white/10 bg-slate-900/60 px-3 py-1 text-[0.7rem] uppercase tracking-[0.18em] text-slate-300/80">
                                  {formatTelegramPriceSourceLabel(entry.priceSource)}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 text-sm text-slate-400">
                              {entry.lastVerifiedAt
                                ? `Проверено ${formatRelativeTime(entry.lastVerifiedAt)}`
                                : "Время проверки не указано"}
                              {entry.confidence ? ` · confidence ${entry.confidence}` : ""}
                            </p>
                          </div>
                          <p className="text-sm text-slate-300/80">{formatRelativeTime(entry.occurredAt)}</p>
                        </div>
                        {entry.outlierMessage ? (
                          <p className="mt-3 text-sm leading-7 text-rose-100/90">{entry.outlierMessage}</p>
                        ) : null}
                        {entry.notes ? (
                          <p className="mt-3 text-sm leading-7 text-slate-300/78">{entry.notes}</p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {selectedGift && form ? (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Закрыть"
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={closeDrawer}
          />
          <div className="relative ml-auto flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-white/10 bg-slate-950/96 shadow-[0_24px_80px_rgba(2,8,23,0.55)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-6">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.32em] text-cyan-200/60">
                  Telegram OTC pricing
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-white">{selectedGift.assetName}</h3>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:text-white"
              >
                Закрыть
              </button>
            </div>

            <form onSubmit={submitPriceUpdate} className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm text-slate-300/78">Новая цена</span>
                  <input
                    value={form.price}
                    onChange={(event) => setForm((current) => (current ? { ...current, price: event.target.value } : current))}
                    disabled={isPending}
                    inputMode="decimal"
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                    placeholder="150"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm text-slate-300/78">Валюта</span>
                  <input
                    value={form.currency}
                    onChange={(event) => setForm((current) => (current ? { ...current, currency: event.target.value.toUpperCase() } : current))}
                    disabled={isPending}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                    placeholder="USD"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm text-slate-300/78">Источник quote</span>
                  <select
                    value={form.priceSource}
                    onChange={(event) => setForm((current) => (current ? { ...current, priceSource: event.target.value as SaasTelegramPriceSource } : current))}
                    disabled={isPending}
                    className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-300/60"
                  >
                    {PRICE_SOURCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm text-slate-300/78">Confidence</span>
                  <select
                    value={form.confidence}
                    onChange={(event) => setForm((current) => (current ? { ...current, confidence: event.target.value as SaasManualAssetConfidence } : current))}
                    disabled={isPending}
                    className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-300/60"
                  >
                    {CONFIDENCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 sm:col-span-2">
                  <span className="text-sm text-slate-300/78">Дата проверки</span>
                  <input
                    type="datetime-local"
                    value={form.lastVerifiedAt}
                    onChange={(event) => setForm((current) => (current ? { ...current, lastVerifiedAt: event.target.value } : current))}
                    disabled={isPending}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300/60"
                  />
                </label>

                <label className="grid gap-2 sm:col-span-2">
                  <span className="text-sm text-slate-300/78">Заметка к quote</span>
                  <textarea
                    value={form.notes}
                    onChange={(event) => setForm((current) => (current ? { ...current, notes: event.target.value } : current))}
                    disabled={isPending}
                    rows={4}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                    placeholder="Например: OTC сделка в чате, 2 оффера около 145-152 USD, выбрал mid-price."
                  />
                </label>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm leading-7 text-slate-300/78">
                Новый `PRICE_UPDATE` сохранит историю цены, confidence, source и lastVerifiedAt. Если новая цена сильно отклоняется от предыдущей, система вернет outlier warning, но не заблокирует апдейт.
              </div>

              <div className="mt-6 flex flex-wrap gap-3 border-t border-white/10 pt-5">
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? "Сохраняю..." : "Сохранить price update"}
                </button>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-white/20 hover:text-white"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
