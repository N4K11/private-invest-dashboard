"use client";

import type { ReactNode } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/app", label: "Обзор" },
  { href: "/app/portfolios", label: "Портфели" },
  { href: "/app/settings", label: "Настройки" },
] as const;

type SaasAppShellProps = {
  children: ReactNode;
  workspaceName: string;
  workspaceRole: string;
  userLabel: string;
};

export function SaasAppShell({
  children,
  workspaceName,
  workspaceRole,
  userLabel,
}: SaasAppShellProps) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <header className="panel rounded-[32px] border border-white/10 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">Hosted SaaS mode</p>
            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{workspaceName}</h1>
            <p className="mt-2 text-sm text-slate-300/80">
              Роль: <span className="text-white">{workspaceRole}</span> · Пользователь: <span className="text-white">{userLabel}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-2xl border px-4 py-2 text-sm transition",
                    isActive
                      ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-100"
                      : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:text-white",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:text-white"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>
      <div className="mt-6 flex-1">{children}</div>
    </div>
  );
}
