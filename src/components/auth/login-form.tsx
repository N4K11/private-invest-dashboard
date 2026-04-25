"use client";

import { useMemo, useState, useTransition } from "react";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function mapLoginError(error: string | null) {
  if (!error) {
    return null;
  }

  switch (error) {
    case "CredentialsSignin":
      return "Неверный email или пароль.";
    case "saas_unavailable":
      return "SaaS-авторизация пока не настроена на этом окружении.";
    default:
      return "Не удалось выполнить вход. Повторите попытку.";
  }
}

export function LoginForm({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const callbackUrl = useMemo(
    () => searchParams.get("callbackUrl") || "/app",
    [searchParams],
  );

  const pageError = mapLoginError(searchParams.get("error"));

  function updateField(name: "email" | "password", value: string) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
        callbackUrl,
      });

      if (!response || response.error) {
        setError(mapLoginError(response?.error ?? null));
        return;
      }

      router.push(response.url ?? callbackUrl);
      router.refresh();
    });
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="email">
          Email
        </label>
        <input
          id="email"
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
        <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="password">
          Пароль
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={(event) => updateField("password", event.target.value)}
          disabled={disabled || isPending}
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
          placeholder="Введите пароль"
        />
      </div>

      {(error || pageError) && (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error ?? pageError}
        </div>
      )}

      <button
        type="submit"
        disabled={disabled || isPending}
        className="w-full rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Выполняю вход..." : "Войти"}
      </button>
    </form>
  );
}
