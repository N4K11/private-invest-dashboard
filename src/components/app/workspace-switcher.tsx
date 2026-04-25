"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import type { SaasWorkspaceMembership } from "@/types/saas";

type WorkspaceSwitcherProps = {
  memberships: SaasWorkspaceMembership[];
  activeWorkspaceSlug: string | null;
};

export function WorkspaceSwitcher({
  memberships,
  activeWorkspaceSlug,
}: WorkspaceSwitcherProps) {
  const router = useRouter();
  const [selectedSlug, setSelectedSlug] = useState(activeWorkspaceSlug ?? memberships[0]?.workspaceSlug ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (memberships.length === 0) {
    return null;
  }

  function handleChange(nextSlug: string) {
    setSelectedSlug(nextSlug);
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/app/workspaces/active", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ workspaceSlug: nextSlug }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(payload?.error ?? "Не удалось переключить workspace.");
        return;
      }

      router.refresh();
    });
  }

  if (memberships.length === 1) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
        <p className="text-[0.68rem] uppercase tracking-[0.28em] text-slate-400">
          Активный workspace
        </p>
        <p className="mt-2 text-sm font-medium text-white">{memberships[0]?.workspaceName}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.28em] text-slate-400">
            Переключение workspace
          </p>
          <p className="mt-1 text-sm text-slate-300/75">
            Активный workspace определяет контекст `/app` и список портфелей.
          </p>
        </div>
        <select
          value={selectedSlug}
          onChange={(event) => handleChange(event.target.value)}
          disabled={isPending}
          className="min-w-[220px] rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
        >
          {memberships.map((membership) => (
            <option key={membership.workspaceId} value={membership.workspaceSlug}>
              {membership.workspaceName} · {membership.role}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="mt-3 text-sm text-rose-200">{error}</p> : null}
    </div>
  );
}
