"use client";

import type { ReactNode } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/app", label: "Обзор", match: "exact" },
  { href: "/app/portfolios", label: "Портфели", match: "prefix" },
  { href: "/app/import", label: "Импорт", match: "exact" },
  { href: "/app/alerts", label: "Алерты", match: "exact" },
  { href: "/app/billing", label: "Биллинг", match: "exact" },
  { href: "/app/settings", label: "Настройки", match: "exact" },
] as const;

type SaasAppShellProps = {
  children: ReactNode;
  workspaceName: string;
  workspaceRole: string;
  userLabel: string;
  workspaceSwitcher?: ReactNode;
};

export function SaasAppShell({
  children,
  workspaceName,
  workspaceRole,
  userLabel,
  workspaceSwitcher,
}: SaasAppShellProps) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <header className="panel rounded-[32px] border border-white/10 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">Hosted SaaS mode</p>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{workspaceName}</h1>
              <p className="mt-2 text-sm text-slate-300/80">
                Роль: <span className="text-white">{workspaceRole}</span>
                <span className="mx-2 text-white/20">•</span>
                Пользователь: <span className="text-white">{userLabel}</span>
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 xl:max-w-3xl xl:items-end">
            {workspaceSwitcher ? <div className="w-full xl:max-w-md">{workspaceSwitcher}</div> : null}
            <div className="flex flex-wrap gap-2 xl:justify-end">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.match === "prefix"
                    ? pathname === item.href || pathname.startsWith(`${item.href}/`)
                    : pathname === item.href;

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
        </div>
      </header>
      <div className="mt-6 flex-1">{children}</div>
    </div>
  );
}