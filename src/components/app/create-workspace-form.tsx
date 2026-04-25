"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    timezone:
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "Europe/Saratov",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateField(name: "name" | "timezone", value: string) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const response = await fetch("/api/app/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; workspace?: { name: string } }
        | null;

      if (!response.ok) {
        setError(payload?.error ?? "Не удалось создать workspace.");
        return;
      }

      setForm((current) => ({ ...current, name: "" }));
      setSuccess(`Workspace «${payload?.workspace?.name ?? "Новый"}» создан.`);
      router.refresh();
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="workspace-create-name">
          Название workspace
        </label>
        <input
          id="workspace-create-name"
          value={form.name}
          onChange={(event) => updateField("name", event.target.value)}
          disabled={isPending}
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
          placeholder="Например, Family Alpha"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="workspace-create-timezone">
          Часовой пояс
        </label>
        <input
          id="workspace-create-timezone"
          value={form.timezone}
          onChange={(event) => updateField("timezone", event.target.value)}
          disabled={isPending}
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
          placeholder="Europe/Saratov"
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {success}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Создаю workspace..." : "Создать workspace"}
      </button>
    </form>
  );
}
