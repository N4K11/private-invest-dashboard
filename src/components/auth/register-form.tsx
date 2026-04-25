"use client";

import { useState, useTransition } from "react";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export function RegisterForm({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
    workspaceName: "",
    timezone:
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "Europe/Saratov",
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateField(name: keyof typeof form, value: string) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        setError(payload?.error ?? "Не удалось создать аккаунт.");
        return;
      }

      const signInResult = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
        callbackUrl: "/app",
      });

      if (!signInResult || signInResult.error) {
        setError("Аккаунт создан, но автоматический вход не выполнился. Войдите вручную.");
        router.push("/login");
        return;
      }

      router.push(signInResult.url ?? "/app");
      router.refresh();
    });
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="displayName">
          Имя или ник
        </label>
        <input
          id="displayName"
          value={form.displayName}
          onChange={(event) => updateField("displayName", event.target.value)}
          disabled={disabled || isPending}
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
          placeholder="Maksim"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="registerEmail">
          Email
        </label>
        <input
          id="registerEmail"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(event) => updateField("email", event.target.value)}
          disabled={disabled || isPending}
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
          placeholder="owner@example.com"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="registerPassword">
          Пароль
        </label>
        <input
          id="registerPassword"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={(event) => updateField("password", event.target.value)}
          disabled={disabled || isPending}
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
          placeholder="Минимум 8 символов, буквы и цифры"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="workspaceName">
          Workspace
        </label>
        <input
          id="workspaceName"
          value={form.workspaceName}
          onChange={(event) => updateField("workspaceName", event.target.value)}
          disabled={disabled || isPending}
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
          placeholder="Например, Maksim Capital"
        />
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={disabled || isPending}
        className="w-full rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Создаю аккаунт..." : "Создать аккаунт"}
      </button>
    </form>
  );
}
