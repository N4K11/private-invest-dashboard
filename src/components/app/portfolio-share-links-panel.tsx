"use client";

import { useState, useTransition } from "react";

import { formatRelativeTime } from "@/lib/utils";
import type { SaasPortfolioShareLink } from "@/types/saas";

function formatDateTime(value: string | null) {
  if (!value) {
    return "Р‘РµР· СЃСЂРѕРєР°";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function describeScope(link: SaasPortfolioShareLink) {
  const flags: string[] = [];

  if (link.scope.hideValues) {
    flags.push("Р±РµР· СЃС‚РѕРёРјРѕСЃС‚Рё");
  }

  if (link.scope.hideQuantities) {
    flags.push("Р±РµР· РєРѕР»РёС‡РµСЃС‚РІ");
  }

  if (link.scope.hidePnl) {
    flags.push("Р±РµР· PnL");
  }

  if (link.scope.allocationOnly) {
    flags.push("С‚РѕР»СЊРєРѕ allocation");
  }

  return flags.length > 0 ? flags.join(" В· ") : "РїРѕР»РЅС‹Р№ read-only view";
}

function normalizeShareUrl(url: string) {
  if (typeof window === "undefined" || /^https?:\/\//i.test(url)) {
    return url;
  }

  return `${window.location.origin}${url}`;
}

type PortfolioShareLinksPanelProps = {
  portfolioId: string;
  shareLinks: SaasPortfolioShareLink[];
};

export function PortfolioShareLinksPanel({
  portfolioId,
  shareLinks,
}: PortfolioShareLinksPanelProps) {
  const [links, setLinks] = useState(shareLinks);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error" | "warning";
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    label: "",
    password: "",
    expiresAt: "",
    hideValues: false,
    hideQuantities: false,
    hidePnl: false,
    allocationOnly: false,
  });

  function setField<Field extends keyof typeof form>(field: Field, value: (typeof form)[Field]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(normalizeShareUrl(url));
      setFeedback({
        tone: "success",
        message: "РЎСЃС‹Р»РєР° СЃРєРѕРїРёСЂРѕРІР°РЅР° РІ Р±СѓС„РµСЂ РѕР±РјРµРЅР°.",
      });
    } catch {
      setFeedback({
        tone: "error",
        message: "РќРµ СѓРґР°Р»РѕСЃСЊ СЃРєРѕРїРёСЂРѕРІР°С‚СЊ СЃСЃС‹Р»РєСѓ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё.",
      });
    }
  }

  function handleCreate() {
    setFeedback(null);

    startTransition(async () => {
      const response = await fetch(`/api/app/portfolios/${portfolioId}/share-links`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          label: form.label,
          password: form.password,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
          hideValues: form.hideValues,
          hideQuantities: form.hideQuantities,
          hidePnl: form.hidePnl,
          allocationOnly: form.allocationOnly,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        shareLink?: SaasPortfolioShareLink;
      } | null;

      if (!response.ok || !payload?.shareLink) {
        setFeedback({
          tone: "error",
          message: payload?.error ?? "РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ share link.",
        });
        return;
      }

      setLinks((current) => [payload.shareLink!, ...current]);
      setForm({
        label: "",
        password: "",
        expiresAt: "",
        hideValues: false,
        hideQuantities: false,
        hidePnl: false,
        allocationOnly: false,
      });
      setFeedback({
        tone: "success",
        message: "РќРѕРІР°СЏ read-only СЃСЃС‹Р»РєР° СЃРѕР·РґР°РЅР°.",
      });
    });
  }

  function handleRevoke(shareLinkId: string) {
    setFeedback(null);

    startTransition(async () => {
      const response = await fetch(
        `/api/app/portfolios/${portfolioId}/share-links/${shareLinkId}`,
        {
          method: "DELETE",
        },
      );

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        shareLink?: SaasPortfolioShareLink;
      } | null;

      if (!response.ok || !payload?.shareLink) {
        setFeedback({
          tone: "error",
          message: payload?.error ?? "РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РѕР·РІР°С‚СЊ share link.",
        });
        return;
      }

      setLinks((current) =>
        current.map((link) =>
          link.id === shareLinkId ? payload.shareLink! : link,
        ),
      );
      setFeedback({
        tone: "warning",
        message: "РЎСЃС‹Р»РєР° РѕС‚РѕР·РІР°РЅР°. РЎС‚Р°СЂС‹Р№ URL Р±РѕР»СЊС€Рµ РЅРµ РѕС‚РєСЂРѕРµС‚ shared view.",
      });
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-[28px] border border-white/10 bg-white/[0.03] p-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-cyan-200/70">
              РќРѕРІР°СЏ СЃСЃС‹Р»РєР°
            </p>
            <h3 className="mt-3 text-xl font-semibold text-white">
              Shareable read-only dashboard
            </h3>
            <p className="mt-3 text-sm leading-7 text-slate-300/76">
              РЎРѕР·РґР°Р№ РѕС‚РґРµР»СЊРЅСѓСЋ СЃСЃС‹Р»РєСѓ РґР»СЏ РёРЅРІРµСЃС‚РѕСЂРѕРІ, РїР°СЂС‚РЅС‘СЂРѕРІ РёР»Рё РєРѕРјР°РЅРґС‹. РњРѕР¶РЅРѕ РІРєР»СЋС‡РёС‚СЊ РїР°СЂРѕР»СЊ, СЃСЂРѕРє Р¶РёР·РЅРё Рё СЃРєСЂС‹С‚СЊ С‡СѓРІСЃС‚РІРёС‚РµР»СЊРЅС‹Рµ РїРѕР»СЏ.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="share-link-label">
                РќР°Р·РІР°РЅРёРµ СЃСЃС‹Р»РєРё
              </label>
              <input
                id="share-link-label"
                value={form.label}
                onChange={(event) => setField("label", event.target.value)}
                disabled={isPending}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                placeholder="РќР°РїСЂРёРјРµСЂ, Investor monthly snapshot"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="share-link-password">
                РџР°СЂРѕР»СЊ (РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ)
              </label>
              <input
                id="share-link-password"
                type="password"
                value={form.password}
                onChange={(event) => setField("password", event.target.value)}
                disabled={isPending}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                placeholder="РћСЃС‚Р°РІСЊ РїСѓСЃС‚С‹Рј РґР»СЏ СЃСЃС‹Р»РєРё Р±РµР· РїР°СЂРѕР»СЏ"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="share-link-expires-at">
                РСЃС‚РµРєР°РµС‚
              </label>
              <input
                id="share-link-expires-at"
                type="datetime-local"
                value={form.expiresAt}
                onChange={(event) => setField("expiresAt", event.target.value)}
                disabled={isPending}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-300/60"
              />
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm leading-7 text-slate-300/76">
              <p className="font-medium text-white">Р§С‚Рѕ СЂРµР°Р»СЊРЅРѕ РїРѕР»СѓС‡РёС‚СЃСЏ</p>
              <p className="mt-2">РЎСЃС‹Р»РєР° РІРµРґРµС‚ РЅР° РѕС‚РґРµР»СЊРЅСѓСЋ РїСѓР±Р»РёС‡РЅРѕ-РЅРµРґРѕСЃС‚СѓРїРЅСѓСЋ shared page Р±РµР· private API, СЃ noindex/nofollow Рё Р±РµР· write-РґРµР№СЃС‚РІРёР№.</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-[24px] border border-white/10 bg-slate-950/45 p-4">
          <p className="text-sm font-semibold text-white">Scope controls</p>
          <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" checked={form.hideValues} onChange={(event) => setField("hideValues", event.target.checked)} disabled={isPending} className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-300" />
            <span>
              <span className="font-medium text-white">РЎРєСЂС‹С‚СЊ СЃС‚РѕРёРјРѕСЃС‚СЊ</span>
              <span className="mt-1 block text-slate-400">РќРµ РїРѕРєР°Р·С‹РІР°С‚СЊ total value, current price Рё valuation РІ С‚Р°Р±Р»РёС†Рµ.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" checked={form.hideQuantities} onChange={(event) => setField("hideQuantities", event.target.checked)} disabled={isPending} className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-300" />
            <span>
              <span className="font-medium text-white">РЎРєСЂС‹С‚СЊ РєРѕР»РёС‡РµСЃС‚РІР°</span>
              <span className="mt-1 block text-slate-400">РќРµ РїРѕРєР°Р·С‹РІР°С‚СЊ РѕР±СЉС‘Рј РїРѕР·РёС†РёРё Рё holdings size.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" checked={form.hidePnl} onChange={(event) => setField("hidePnl", event.target.checked)} disabled={isPending} className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-300" />
            <span>
              <span className="font-medium text-white">РЎРєСЂС‹С‚СЊ PnL</span>
              <span className="mt-1 block text-slate-400">РќРµ РїРѕРєР°Р·С‹РІР°С‚СЊ profit/loss Рё ROI.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" checked={form.allocationOnly} onChange={(event) => setField("allocationOnly", event.target.checked)} disabled={isPending} className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-300" />
            <span>
              <span className="font-medium text-white">РўРѕР»СЊРєРѕ allocation</span>
              <span className="mt-1 block text-slate-400">РџРѕРєР°Р·Р°С‚СЊ С‚РѕР»СЊРєРѕ breakdown РїРѕ РєР°С‚РµРіРѕСЂРёСЏРј Р±РµР· СЃРїРёСЃРєР° РїРѕР·РёС†РёР№.</span>
            </span>
          </label>
          <button
            type="button"
            onClick={handleCreate}
            disabled={isPending}
            className="w-full rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "РЎРѕР·РґР°СЋ СЃСЃС‹Р»РєСѓ..." : "РЎРѕР·РґР°С‚СЊ СЃСЃС‹Р»РєСѓ"}
          </button>
        </div>
      </div>

      {feedback ? (
        <div className={feedback.tone === "success" ? "rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100" : feedback.tone === "warning" ? "rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100" : "rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"}>
          {feedback.message}
        </div>
      ) : null}

      <div className="space-y-3">
        {links.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-white/12 bg-white/[0.03] px-5 py-5 text-sm leading-7 text-slate-300/76">
            РђРєС‚РёРІРЅС‹С… share links РїРѕРєР° РЅРµС‚. РџРµСЂРІР°СЏ СЃСЃС‹Р»РєР° РїРѕСЏРІРёС‚СЃСЏ Р·РґРµСЃСЊ СЃСЂР°Р·Сѓ РїРѕСЃР»Рµ СЃРѕР·РґР°РЅРёСЏ.
          </div>
        ) : (
          links.map((link) => (
            <article key={link.id} className="rounded-[24px] border border-white/10 bg-white/[0.03] px-5 py-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2 text-[0.68rem] uppercase tracking-[0.22em] text-slate-300/78">
                    <span className={link.status === "active" ? "rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-emerald-100" : link.status === "expired" ? "rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-amber-100" : "rounded-full border border-rose-400/25 bg-rose-400/10 px-3 py-1 text-rose-100"}>
                      {link.status === "active" ? "active" : link.status === "expired" ? "expired" : "revoked"}
                    </span>
                    {link.requiresPassword ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">password</span> : null}
                    {link.scope.allocationOnly ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">allocation only</span> : null}
                  </div>
                  <h4 className="mt-4 text-lg font-semibold text-white">{link.label ?? "Р‘РµР· РЅР°Р·РІР°РЅРёСЏ"}</h4>
                  <p className="mt-3 break-all text-sm leading-7 text-cyan-200/82">{normalizeShareUrl(link.shareUrl)}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{describeScope(link)}</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">СЃРѕР·РґР°РЅР° {formatRelativeTime(link.createdAt)}</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">РёСЃС‚РµРєР°РµС‚ {formatDateTime(link.expiresAt)}</span>
                    {link.lastAccessedAt ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">РїРѕСЃР»РµРґРЅРёР№ РїСЂРѕСЃРјРѕС‚СЂ {formatRelativeTime(link.lastAccessedAt)}</span> : null}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:w-[300px] xl:grid-cols-1">
                  <button
                    type="button"
                    onClick={() => handleCopy(link.shareUrl)}
                    disabled={isPending}
                    className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    РЎРєРѕРїРёСЂРѕРІР°С‚СЊ СЃСЃС‹Р»РєСѓ
                  </button>
                  <a
                    href={normalizeShareUrl(link.shareUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-slate-200 transition hover:border-white/20 hover:text-white"
                  >
                    РћС‚РєСЂС‹С‚СЊ shared view
                  </a>
                  <button
                    type="button"
                    onClick={() => handleRevoke(link.id)}
                    disabled={isPending || link.status !== "active"}
                    className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100 transition hover:border-rose-300/40 hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    РћС‚РѕР·РІР°С‚СЊ СЃСЃС‹Р»РєСѓ
                  </button>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300/76">
                    <p className="font-medium text-white">РЎСЂРѕРє Р¶РёР·РЅРё</p>
                    <p className="mt-2">{link.expiresAt ? formatDateTime(link.expiresAt) : "Р‘РµР· РѕРіСЂР°РЅРёС‡РµРЅРёСЏ РїРѕ РІСЂРµРјРµРЅРё"}</p>
                  </div>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}