"use client";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { DashboardStatePanel } from "@/components/dashboard/dashboard-state-panel";
import {
  formatPriceSourceLabel,
  formatSaasPriceConfidenceLabel,
} from "@/lib/presentation";
import {
  cn,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRelativeTime,
} from "@/lib/utils";
import type {
  SaasManualAssetCategory,
  SaasManualAssetConfidence,
  SaasManualAssetLiquidity,
  SaasManualTransactionMode,
  SaasPortfolioPositionRow,
  SaasPriceConfidenceStatus,
  SaasWorkspaceLimitSnapshot,
} from "@/types/saas";

const TEXT = {
  addAsset: "Р вЂќР С•Р В±Р В°Р Р†Р С‘РЎвЂљРЎРЉ Р В°Р С”РЎвЂљР С‘Р Р†",
  createFirst: "Р РЋР С•Р В·Р Т‘Р В°РЎвЂљРЎРЉ Р С—Р ВµРЎР‚Р Р†РЎС“РЎР‹ Р С—Р С•Р В·Р С‘РЎвЂ Р С‘РЎР‹",
  noPositionsEyebrow: "Manual Asset Manager",
  noPositionsTitle: "Р вЂ™ Р С—Р С•РЎР‚РЎвЂљРЎвЂћР ВµР В»Р Вµ Р С—Р С•Р С”Р В° Р Р…Р ВµРЎвЂљ Р С—Р С•Р В·Р С‘РЎвЂ Р С‘Р в„–",
  noPositionsDescription:
    "Р вЂќР С•Р В±Р В°Р Р†РЎРЉРЎвЂљР Вµ Р В°Р С”РЎвЂљР С‘Р Р† Р Р†РЎР‚РЎС“РЎвЂЎР Р…РЎС“РЎР‹ Р С‘Р В»Р С‘ Р С‘Р СР С—Р С•РЎР‚РЎвЂљР С‘РЎР‚РЎС“Р в„–РЎвЂљР Вµ holdings, РЎвЂЎРЎвЂљР С•Р В±РЎвЂ№ РЎвЂљР ВµРЎР‚Р СР С‘Р Р…Р В°Р В» Р Р…Р В°РЎвЂЎР В°Р В» РЎРѓРЎвЂЎР С‘РЎвЂљР В°РЎвЂљРЎРЉ PnL Р С‘ Р С‘РЎРѓРЎвЂљР С•РЎР‚Р С‘РЎР‹.",
  viewOnly: "Р Р€ Р Р†Р В°РЎРѓ РЎвЂљР С•Р В»РЎРЉР С”Р С• Р С—РЎР‚Р С•РЎРѓР СР С•РЎвЂљРЎР‚",
  newPosition: "Р СњР С•Р Р†Р В°РЎРЏ Р С—Р С•Р В·Р С‘РЎвЂ Р С‘РЎРЏ",
  editPosition: "Р В Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘Р Вµ Р С—Р С•Р В·Р С‘РЎвЂ Р С‘Р С‘",
  close: "Р вЂ”Р В°Р С”РЎР‚РЎвЂ№РЎвЂљРЎРЉ",
  save: "Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…Р С‘РЎвЂљРЎРЉ",
  saving: "Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏРЎР‹...",
  cancel: "Р С›РЎвЂљР СР ВµР Р…Р В°",
  edit: "Р В Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉ",
  delete: "Р Р€Р Т‘Р В°Р В»Р С‘РЎвЂљРЎРЉ",
  created: "Р СџР С•Р В·Р С‘РЎвЂ Р С‘РЎРЏ РЎРѓР С•Р В·Р Т‘Р В°Р Р…Р В°.",
  updated: "Р СџР С•Р В·Р С‘РЎвЂ Р С‘РЎРЏ Р С•Р В±Р Р…Р С•Р Р†Р В»Р ВµР Р…Р В°.",
  deleted: "Р СџР С•Р В·Р С‘РЎвЂ Р С‘РЎРЏ РЎС“Р Т‘Р В°Р В»Р ВµР Р…Р В°.",
  deleteConfirm: "Р Р€Р Т‘Р В°Р В»Р С‘РЎвЂљРЎРЉ Р С—Р С•Р В·Р С‘РЎвЂ Р С‘РЎР‹?",
  assetType: "Р СћР С‘Р С— Р В°Р С”РЎвЂљР С‘Р Р†Р В°",
  name: "Р СњР В°Р В·Р Р†Р В°Р Р…Р С‘Р Вµ",
  quantity: "Р С™Р С•Р В»Р С‘РЎвЂЎР ВµРЎРѓРЎвЂљР Р†Р С•",
  entryPrice: "Р В¦Р ВµР Р…Р В° Р Р†РЎвЂ¦Р С•Р Т‘Р В°",
  manualPrice: "Р СћР ВµР С”РЎС“РЎвЂ°Р В°РЎРЏ РЎвЂ Р ВµР Р…Р В°",
  currency: "Р вЂ™Р В°Р В»РЎР‹РЎвЂљР В°",
  tags: "Р СћР ВµР С–Р С‘",
  liquidity: "Р вЂєР С‘Р С”Р Р†Р С‘Р Т‘Р Р…Р С•РЎРѓРЎвЂљРЎРЉ",
  confidence: "Р Р€Р Р†Р ВµРЎР‚Р ВµР Р…Р Р…Р С•РЎРѓРЎвЂљРЎРЉ",
  notes: "Р вЂ”Р В°Р СР ВµРЎвЂљР С”Р С‘",
  mode: "Р В Р ВµР В¶Р С‘Р С РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘РЎРЏ",
  value: "Р РЋРЎвЂљР С•Р С‘Р СР С•РЎРѓРЎвЂљРЎРЉ",
  pnl: "PnL",
  source: "Р ВРЎРѓРЎвЂљР С•РЎвЂЎР Р…Р С‘Р С”",
  roi: "ROI",
  updatedAt: "Р С›Р В±Р Р…Р С•Р Р†Р В»Р ВµР Р…Р С•",
  priceQuality: "Р С™Р В°РЎвЂЎР ВµРЎРѓРЎвЂљР Р†Р С• РЎвЂ Р ВµР Р…РЎвЂ№",
  priceUpdated: "Р В¦Р ВµР Р…Р В° Р С•Р В±Р Р…Р С•Р Р†Р В»Р ВµР Р…Р В°",
  priceWarning: "Р В Р С‘РЎРѓР С” Р С—Р С• РЎвЂ Р ВµР Р…Р Вµ",
  info: "Р вЂќР В°Р Р…Р Р…РЎвЂ№Р Вµ",
  tagsPlaceholder: "skin, longterm, otc",
  notesPlaceholder: "Р С™Р С•РЎР‚Р С•РЎвЂљР С”Р С‘Р в„– Р С”Р С•Р Р…РЎвЂљР ВµР С”РЎРѓРЎвЂљ Р С—Р С• Р С—Р С•Р В·Р С‘РЎвЂ Р С‘Р С‘",
  quantityHintBuy: "Р вЂќР В»РЎРЏ buy Р С‘РЎвЂљР С•Р С–Р С•Р Р†Р С•Р Вµ Р С”Р С•Р В»Р С‘РЎвЂЎР ВµРЎРѓРЎвЂљР Р†Р С• Р Т‘Р С•Р В»Р В¶Р Р…Р С• Р В±РЎвЂ№РЎвЂљРЎРЉ Р Р†РЎвЂ№РЎв‚¬Р Вµ РЎвЂљР ВµР С”РЎС“РЎвЂ°Р ВµР С–Р С•.",
  quantityHintSell: "Р вЂќР В»РЎРЏ sell Р С‘РЎвЂљР С•Р С–Р С•Р Р†Р С•Р Вµ Р С”Р С•Р В»Р С‘РЎвЂЎР ВµРЎРѓРЎвЂљР Р†Р С• Р Т‘Р С•Р В»Р В¶Р Р…Р С• Р В±РЎвЂ№РЎвЂљРЎРЉ Р Р…Р С‘Р В¶Р Вµ РЎвЂљР ВµР С”РЎС“РЎвЂ°Р ВµР С–Р С•.",
};

const CATEGORY_OPTIONS: { value: SaasManualAssetCategory; label: string }[] = [
  { value: "cs2", label: "CS2" },
  { value: "telegram", label: "Telegram Gift" },
  { value: "crypto", label: "Р С™РЎР‚Р С‘Р С—РЎвЂљР С•" },
  { value: "custom", label: "Custom collectible" },
];

const LIQUIDITY_OPTIONS: { value: SaasManualAssetLiquidity; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "unknown", label: "Unknown" },
];

const CONFIDENCE_OPTIONS: { value: SaasManualAssetConfidence; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const CREATE_MODE_OPTIONS: { value: Extract<SaasManualTransactionMode, "buy" | "adjustment">; label: string }[] = [
  { value: "buy", label: "Р СџР С•Р С”РЎС“Р С—Р С”Р В° + trade log" },
  { value: "adjustment", label: "Р СџРЎР‚Р С•РЎРѓРЎвЂљР С• РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р С‘РЎвЂљРЎРЉ Р С—Р С•Р В·Р С‘РЎвЂ Р С‘РЎР‹" },
];

const EDIT_MODE_OPTIONS: { value: SaasManualTransactionMode; label: string }[] = [
  { value: "adjustment", label: "Р СџРЎР‚Р С•РЎРѓРЎвЂљР С• Р С•Р В±Р Р…Р С•Р Р†Р С‘РЎвЂљРЎРЉ Р С—Р С•Р В·Р С‘РЎвЂ Р С‘РЎР‹" },
  { value: "buy", label: "Р СџР С•Р С”РЎС“Р С—Р С”Р В° + trade log" },
  { value: "sell", label: "Р СџРЎР‚Р С•Р Т‘Р В°Р В¶Р В° + trade log" },
];

type ManualAssetManagerProps = {
  portfolioId: string;
  baseCurrency: string;
  canManage: boolean;
  positions: SaasPortfolioPositionRow[];
  limitSnapshot: SaasWorkspaceLimitSnapshot;
};

type FormState = {
  category: SaasManualAssetCategory;
  name: string;
  quantity: string;
  entryPrice: string;
  currentManualPrice: string;
  currency: string;
  tags: string;
  liquidity: SaasManualAssetLiquidity;
  confidence: SaasManualAssetConfidence;
  notes: string;
  transactionMode: SaasManualTransactionMode;
};

function createEmptyForm(baseCurrency: string): FormState {
  return {
    category: "cs2",
    name: "",
    quantity: "",
    entryPrice: "",
    currentManualPrice: "",
    currency: baseCurrency || "USD",
    tags: "",
    liquidity: "unknown",
    confidence: "medium",
    notes: "",
    transactionMode: "buy",
  };
}

function normalizeEditableCategory(
  category: SaasPortfolioPositionRow["category"],
): SaasManualAssetCategory {
  switch (category) {
    case "cs2":
    case "telegram":
    case "crypto":
    case "custom":
      return category;
    default:
      return "custom";
  }
}

function toFormState(position: SaasPortfolioPositionRow, baseCurrency: string): FormState {
  return {
    category: normalizeEditableCategory(position.category),
    name: position.assetName,
    quantity: String(position.quantity),
    entryPrice:
      position.averageEntryPrice !== null && Number.isFinite(position.averageEntryPrice)
        ? String(position.averageEntryPrice)
        : "",
    currentManualPrice:
      position.manualCurrentPrice !== null && Number.isFinite(position.manualCurrentPrice)
        ? String(position.manualCurrentPrice)
        : position.currentPrice !== null && Number.isFinite(position.currentPrice)
          ? String(position.currentPrice)
          : "",
    currency: position.currency ?? baseCurrency,
    tags: position.tags.join(", "),
    liquidity: position.liquidity ?? "unknown",
    confidence: position.confidence ?? "medium",
    notes: position.notes ?? "",
    transactionMode: "adjustment",
  };
}

function parseNullableNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTags(value: string) {
  return [...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))];
}

function getPriceConfidenceTone(status: SaasPriceConfidenceStatus) {
  switch (status) {
    case "live_high":
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
    case "live_medium":
      return "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";
    case "manual_high":
      return "border-violet-300/25 bg-violet-300/10 text-violet-100";
    case "manual_low":
      return "border-amber-300/25 bg-amber-300/10 text-amber-100";
    case "stale":
      return "border-orange-300/25 bg-orange-300/10 text-orange-100";
    default:
      return "border-rose-400/25 bg-rose-400/10 text-rose-100";
  }
}

function getPriceConfidenceHint(status: SaasPriceConfidenceStatus) {
  switch (status) {
    case "live_high":
      return "Live quote Р С‘Р В· Р С•РЎРѓР Р…Р С•Р Р†Р Р…Р С•Р С–Р С• Р С—РЎР‚Р С•Р Р†Р В°Р в„–Р Т‘Р ВµРЎР‚Р В°.";
    case "live_medium":
      return "Live quote Р С‘Р В· fallback-Р С—РЎР‚Р С•Р Р†Р В°Р в„–Р Т‘Р ВµРЎР‚Р В°.";
    case "manual_high":
      return "Р В РЎС“РЎвЂЎР Р…Р В°РЎРЏ РЎвЂ Р ВµР Р…Р В° Р Р†РЎвЂ№Р С–Р В»РЎРЏР Т‘Р С‘РЎвЂљ РЎРѓР Р†Р ВµР В¶Р ВµР в„– Р С‘ Р Т‘Р С•РЎРѓРЎвЂљР В°РЎвЂљР С•РЎвЂЎР Р…Р С• Р Р…Р В°Р Т‘Р ВµР В¶Р Р…Р С•Р в„–.";
    case "manual_low":
      return "Р В¦Р ВµР Р…Р В° РЎР‚РЎС“РЎвЂЎР Р…Р В°РЎРЏ, Р Р…РЎС“Р В¶Р Р…Р В° Р Т‘Р С•Р С—Р С•Р В»Р Р…Р С‘РЎвЂљР ВµР В»РЎРЉР Р…Р В°РЎРЏ Р С—РЎР‚Р С•Р Р†Р ВµРЎР‚Р С”Р В°.";
    case "stale":
      return "Р В¦Р ВµР Р…Р В° РЎС“РЎРѓРЎвЂљР В°РЎР‚Р ВµР В»Р В° Р С‘ Р Р†Р В»Р С‘РЎРЏР ВµРЎвЂљ Р Р…Р В° РЎвЂљР С•РЎвЂЎР Р…Р С•РЎРѓРЎвЂљРЎРЉ Р С•РЎвЂ Р ВµР Р…Р С”Р С‘.";
    default:
      return "Р вЂќР В»РЎРЏ Р С—Р С•Р В·Р С‘РЎвЂ Р С‘Р С‘ Р ВµРЎвЂ°Р Вµ Р Р…Р ВµРЎвЂљ Р С—РЎР‚Р С‘Р С–Р С•Р Т‘Р Р…Р С•Р в„– РЎвЂ Р ВµР Р…РЎвЂ№.";
  }
}

export function ManualAssetManager({
  portfolioId,
  baseCurrency,
  canManage,
  positions,
  limitSnapshot,
}: ManualAssetManagerProps) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<SaasPortfolioPositionRow | null>(null);
  const [form, setForm] = useState<FormState>(() => createEmptyForm(baseCurrency));
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const positionUsage = limitSnapshot.usage.find((metric) => metric.key === "positions") ?? null;
  const positionLimit = positionUsage?.limit ?? null;
  const positionRemaining = positionUsage?.remaining ?? null;
  const positionCreateBlocked =
    canManage && Boolean(positionLimit !== null && positionRemaining === 0);

  function resetDrawer() {
    setDrawerOpen(false);
    setEditingPosition(null);
    setForm(createEmptyForm(baseCurrency));
  }

  function openCreateDrawer() {
    setFeedback(null);
    setEditingPosition(null);
    setForm(createEmptyForm(baseCurrency));
    setDrawerOpen(true);
  }

  function openEditDrawer(position: SaasPortfolioPositionRow) {
    setFeedback(null);
    setEditingPosition(position);
    setForm(toFormState(position, baseCurrency));
    setDrawerOpen(true);
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const quantity = Number(form.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) {
      setFeedback({ tone: "error", message: "Quantity must be a valid non-negative number." });
      return;
    }

    if (!editingPosition && quantity <= 0) {
      setFeedback({ tone: "error", message: "Quantity must be greater than zero for a new position." });
      return;
    }

    if (!editingPosition && positionCreateBlocked) {
      setFeedback({ tone: "error", message: "Р вЂєР С‘Р СР С‘РЎвЂљ РЎвЂљР В°РЎР‚Р С‘РЎвЂћР В° Р С—Р С• Р С—Р С•Р В·Р С‘РЎвЂ Р С‘РЎРЏР С Р С‘РЎРѓРЎвЂЎР ВµРЎР‚Р С—Р В°Р Р…. Р СџР ВµРЎР‚Р ВµР в„–Р Т‘Р С‘РЎвЂљР Вµ Р Р† Billing Р С‘ Р С•Р В±Р Р…Р С•Р Р†Р С‘РЎвЂљР Вµ Р С—Р В»Р В°Р Р…." });
      return;
    }

    startTransition(async () => {
      const isEditing = Boolean(editingPosition);
      const response = await fetch(
        isEditing
          ? `/api/app/portfolios/${portfolioId}/positions/${editingPosition!.id}`
          : `/api/app/portfolios/${portfolioId}/positions`,
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            category: form.category,
            name: form.name.trim(),
            quantity,
            entryPrice: parseNullableNumber(form.entryPrice),
            currentManualPrice: parseNullableNumber(form.currentManualPrice),
            currency: form.currency.trim().toUpperCase(),
            tags: parseTags(form.tags),
            liquidity: form.liquidity,
            confidence: form.confidence,
            notes: form.notes.trim() || null,
            transactionMode: form.transactionMode,
          }),
        },
      );

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setFeedback({
          tone: "error",
          message: payload?.error ?? (isEditing ? "Failed to update position." : "Failed to create position."),
        });
        return;
      }

      setFeedback({
        tone: "success",
        message: isEditing ? TEXT.updated : TEXT.created,
      });
      resetDrawer();
      router.refresh();
    });
  }

  function deletePosition(position: SaasPortfolioPositionRow) {
    if (!window.confirm(`${TEXT.deleteConfirm} ${position.assetName}?`)) {
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      const response = await fetch(`/api/app/portfolios/${portfolioId}/positions/${position.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setFeedback({
          tone: "error",
          message: payload?.error ?? "Failed to delete position.",
        });
        return;
      }

      setFeedback({ tone: "success", message: TEXT.deleted });
      if (editingPosition?.id === position.id) {
        resetDrawer();
      }
      router.refresh();
    });
  }

  const transactionHint =
    editingPosition && form.transactionMode === "buy"
      ? TEXT.quantityHintBuy
      : editingPosition && form.transactionMode === "sell"
        ? TEXT.quantityHintSell
        : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        ) : (
          <div className="text-sm text-slate-400">{canManage ? TEXT.info : TEXT.viewOnly}</div>
        )}

        {canManage ? (
          <button
            type="button"
            onClick={openCreateDrawer}
            disabled={positionCreateBlocked}
            className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {positionCreateBlocked ? "Р вЂєР С‘Р СР С‘РЎвЂљ Р Т‘Р С•РЎРѓРЎвЂљР С‘Р С–Р Р…РЎС“РЎвЂљ" : TEXT.addAsset}
          </button>
        ) : null}
      </div>

      <div className={`rounded-2xl px-4 py-4 text-sm leading-7 ${
        positionCreateBlocked
          ? "border border-rose-400/30 bg-rose-400/10 text-rose-100"
          : positionUsage?.isNearLimit
            ? "border border-amber-300/25 bg-amber-300/10 text-amber-100"
            : "border border-white/10 bg-white/[0.03] text-slate-300/82"
      }`}>
        <p>
          Positions used: {positionUsage?.used ?? positions.length}
          {positionLimit !== null ? ` из ${positionLimit}` : ""}.
          {positionRemaining !== null ? ` Осталось ${positionRemaining}.` : ""}
        </p>
        <p className="mt-2">
          Price refresh gate: {limitSnapshot.effectiveLimits.priceRefreshHours ?? "Р В±Р ВµР В· Р В»Р С‘Р СР С‘РЎвЂљР В°"}РЎвЂЎ Р’В· history retention: {limitSnapshot.effectiveLimits.historyRetentionDays ?? "Р В±Р ВµР В· Р В»Р С‘Р СР С‘РЎвЂљР В°"} Р Т‘Р Р…Р ВµР в„–.
        </p>
        {canManage ? (
          <Link href="/app/billing" className="mt-3 inline-flex rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-100 transition hover:border-white/20 hover:text-white">
            Billing
          </Link>
        ) : null}
      </div>

      {positions.length === 0 ? (
        <DashboardStatePanel
          eyebrow={TEXT.noPositionsEyebrow}
          title={TEXT.noPositionsTitle}
          description={TEXT.noPositionsDescription}
          className="min-h-[260px]"
          action={
            canManage ? (
              <button
                type="button"
                onClick={openCreateDrawer}
                disabled={positionCreateBlocked}
            className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {TEXT.createFirst}
              </button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          {positions.map((position) => {
            const effectiveCurrentPrice = position.manualCurrentPrice ?? position.currentPrice;
            const roi = position.totalCost > 0 ? (position.pnl / position.totalCost) * 100 : null;

            return (
              <article
                key={position.id}
                className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-white">{position.assetName}</h3>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.7rem] uppercase tracking-[0.18em] text-slate-300/80">
                        {CATEGORY_OPTIONS.find((option) => option.value === normalizeEditableCategory(position.category))?.label ?? position.category}
                      </span>
                      {position.symbol ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.7rem] uppercase tracking-[0.18em] text-slate-300/80">
                          {position.symbol}
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          "rounded-full border px-3 py-1 text-[0.7rem] uppercase tracking-[0.18em]",
                          getPriceConfidenceTone(position.priceConfidenceStatus),
                        )}
                      >
                        {formatSaasPriceConfidenceLabel(position.priceConfidenceStatus)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      qty: {formatNumber(position.quantity, 6)} | status: {position.status}
                      {position.currency ? ` | ${position.currency}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canManage ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditDrawer(position)}
                          className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100 transition hover:border-cyan-300/40"
                        >
                          {TEXT.edit}
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePosition(position)}
                          className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-2 text-sm text-rose-100 transition hover:border-rose-400/40"
                        >
                          {TEXT.delete}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{TEXT.value}</p>
                    <p className="mt-2 text-sm text-white">
                      {formatCurrency(position.totalValue, baseCurrency)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{TEXT.pnl}</p>
                    <p className={cn("mt-2 text-sm", position.pnl >= 0 ? "text-emerald-200" : "text-rose-200")}>
                      {formatCurrency(position.pnl, baseCurrency)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{TEXT.source}</p>
                    <p className="mt-2 text-sm text-white">
                      {position.priceSource ? formatPriceSourceLabel(position.priceSource) : "Manual"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{TEXT.priceQuality}</p>
                    <p className="mt-2 text-sm text-white">
                      {formatSaasPriceConfidenceLabel(position.priceConfidenceStatus)}
                    </p>
                    <p className="mt-2 text-xs leading-6 text-slate-400">
                      {getPriceConfidenceHint(position.priceConfidenceStatus)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{TEXT.entryPrice}</p>
                    <p className="mt-2 text-sm text-white">
                      {position.averageEntryPrice !== null
                        ? formatCurrency(position.averageEntryPrice, position.currency ?? baseCurrency, 2)
                        : "-"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{TEXT.manualPrice}</p>
                    <p className="mt-2 text-sm text-white">
                      {effectiveCurrentPrice !== null
                        ? formatCurrency(effectiveCurrentPrice, position.currency ?? baseCurrency, 2)
                        : "-"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{TEXT.liquidity}</p>
                    <p className="mt-2 text-sm text-white">{position.liquidity ?? "unknown"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{TEXT.roi}</p>
                    <p className="mt-2 text-sm text-white">
                      {roi !== null ? formatPercent(roi, 1) : "-"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300/78">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {TEXT.updatedAt}: {formatRelativeTime(position.updatedAt)}
                  </span>
                  {position.priceUpdatedAt ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      {TEXT.priceUpdated}: {formatRelativeTime(position.priceUpdatedAt)}
                    </span>
                  ) : null}
                  {position.tags.map((tag) => (
                    <span
                      key={`${position.id}-${tag}`}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                {position.priceWarning ? (
                  <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-4 text-sm leading-7 text-amber-50/90">
                    <span className="font-semibold">{TEXT.priceWarning}: </span>
                    {position.priceWarning}
                  </div>
                ) : null}

                {position.notes ? (
                  <p className="mt-4 text-sm leading-7 text-slate-300/75">{position.notes}</p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm">
          <button
            type="button"
            aria-label={TEXT.close}
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={resetDrawer}
          />
          <div className="relative ml-auto flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-white/10 bg-slate-950/96 shadow-[0_24px_80px_rgba(2,8,23,0.55)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-6">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.32em] text-cyan-200/60">
                  Manual Asset Manager
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-white">
                  {editingPosition ? TEXT.editPosition : TEXT.newPosition}
                </h3>
              </div>
              <button
                type="button"
                onClick={resetDrawer}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:text-white"
              >
                {TEXT.close}
              </button>
            </div>

            <form onSubmit={submitForm} className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm text-slate-300/78">{TEXT.assetType}</span>
                  <select
                    value={form.category}
                    onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as SaasManualAssetCategory }))}
                    disabled={isPending}
                    className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-300/60"
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm text-slate-300/78">{TEXT.name}</span>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    disabled={isPending}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                    placeholder="AWP | Dragon Lore"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm text-slate-300/78">{TEXT.quantity}</span>
                  <input
                    value={form.quantity}
                    onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
                    disabled={isPending}
                    inputMode="decimal"
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                    placeholder="1"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm text-slate-300/78">{TEXT.currency}</span>
                  <input
                    value={form.currency}
                    onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
                    disabled={isPending}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                    placeholder="USD"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm text-slate-300/78">{TEXT.entryPrice}</span>
                  <input
                    value={form.entryPrice}
                    onChange={(event) => setForm((current) => ({ ...current, entryPrice: event.target.value }))}
                    disabled={isPending}
                    inputMode="decimal"
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                    placeholder="120"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm text-slate-300/78">{TEXT.manualPrice}</span>
                  <input
                    value={form.currentManualPrice}
                    onChange={(event) => setForm((current) => ({ ...current, currentManualPrice: event.target.value }))}
                    disabled={isPending}
                    inputMode="decimal"
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                    placeholder="135"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm text-slate-300/78">{TEXT.liquidity}</span>
                  <select
                    value={form.liquidity}
                    onChange={(event) => setForm((current) => ({ ...current, liquidity: event.target.value as SaasManualAssetLiquidity }))}
                    disabled={isPending}
                    className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-300/60"
                  >
                    {LIQUIDITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm text-slate-300/78">{TEXT.confidence}</span>
                  <select
                    value={form.confidence}
                    onChange={(event) => setForm((current) => ({ ...current, confidence: event.target.value as SaasManualAssetConfidence }))}
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
                  <span className="text-sm text-slate-300/78">{TEXT.tags}</span>
                  <input
                    value={form.tags}
                    onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
                    disabled={isPending}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                    placeholder={TEXT.tagsPlaceholder}
                  />
                </label>

                <label className="grid gap-2 sm:col-span-2">
                  <span className="text-sm text-slate-300/78">{TEXT.notes}</span>
                  <textarea
                    value={form.notes}
                    onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                    disabled={isPending}
                    rows={4}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                    placeholder={TEXT.notesPlaceholder}
                  />
                </label>

                <label className="grid gap-2 sm:col-span-2">
                  <span className="text-sm text-slate-300/78">{TEXT.mode}</span>
                  <select
                    value={form.transactionMode}
                    onChange={(event) => setForm((current) => ({ ...current, transactionMode: event.target.value as SaasManualTransactionMode }))}
                    disabled={isPending}
                    className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-300/60"
                  >
                    {(editingPosition ? EDIT_MODE_OPTIONS : CREATE_MODE_OPTIONS).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {transactionHint ? (
                    <p className="text-xs leading-6 text-amber-100/80">{transactionHint}</p>
                  ) : null}
                </label>
              </div>

              <div className="mt-6 flex flex-wrap gap-3 border-t border-white/10 pt-5">
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? TEXT.saving : TEXT.save}
                </button>
                <button
                  type="button"
                  onClick={resetDrawer}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-white/20 hover:text-white"
                >
                  {TEXT.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
