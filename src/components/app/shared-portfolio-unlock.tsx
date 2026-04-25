"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type SharedPortfolioUnlockProps = {
  shareToken: string;
  shareLabel: string | null;
  expiresAt: string | null;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "Без срока";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function SharedPortfolioUnlock({
  shareToken,
  shareLabel,
  expiresAt,
}: SharedPortfolioUnlockProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const response = await fetch(`/api/share-links/${shareToken}/unlock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setFeedback(payload?.error ?? "Не удалось открыть shared view.");
        return;
      }

      setPassword("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <p className="text-[0.68rem] uppercase tracking-[0.3em] text-cyan-200/72">
        Защищённая shared page
      </p>
      <h2 className="mt-4 text-2xl font-semibold text-white sm:text-3xl">
        {shareLabel ?? "Доступ по паролю"}
      </h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300/76">
        Владелец добавил пароль к этой view-only ссылке. После успешной проверки браузер получит подписанную access-cookie только для этого shared route.
      </p>
      <div className="mt-5 flex flex-wrap gap-2 text-xs uppercase tracking-[0.2em] text-slate-300/75">
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">read only</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">expires {formatDateTime(expiresAt)}</span>
      </div>
      <div className="mt-6 max-w-md space-y-3">
        <label className="block text-sm font-medium text-slate-200" htmlFor="share-password">
          Пароль
        </label>
        <input
          id="share-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isPending}
          className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
          placeholder="Введите пароль для shared view"
        />
        {feedback ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {feedback}
          </div>
        ) : null}
        <button
          type="submit"
          disabled={isPending || password.trim().length === 0}
          className="w-full rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Проверяю пароль..." : "Открыть shared view"}
        </button>
      </div>
    </form>
  );
}