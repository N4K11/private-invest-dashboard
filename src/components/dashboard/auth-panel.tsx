"use client";

import { useState } from "react";

type AuthPanelProps = {
  redirectTo: string;
  disabled?: boolean;
};

export function AuthPanel({ redirectTo, disabled = false }: AuthPanelProps) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/private/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          redirectTo,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; redirectTo?: string }
        | null;

      if (!response.ok) {
        setError(payload?.error ?? "Доступ отклонен.");
        return;
      }

      window.location.assign(payload?.redirectTo ?? redirectTo);
    } catch {
      setError("Сетевая ошибка при проверке токена доступа.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label
          htmlFor="dashboard-token"
          className="text-xs uppercase tracking-[0.24em] text-slate-400"
        >
          Токен доступа
        </label>
        <input
          id="dashboard-token"
          type="password"
          autoComplete="current-password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          disabled={isSubmitting || disabled}
          className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-base text-white outline-none transition focus:border-cyan-300/50 focus:bg-white/8"
          placeholder="Введи приватный токен"
        />
      </div>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      <button
        type="submit"
        disabled={isSubmitting || disabled || token.trim().length === 0}
        className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#14d9aa,#377dff)] px-5 py-3 text-sm font-medium text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {disabled ? "Сначала настрой секреты" : isSubmitting ? "Проверяю доступ..." : "Открыть дашборд"}
      </button>
      <p className="text-sm leading-6 text-slate-400">
        Можно также открыть приватную ссылку сразу с параметром <span className="font-mono text-slate-200">?token=...</span>.
      </p>
    </form>
  );
}

