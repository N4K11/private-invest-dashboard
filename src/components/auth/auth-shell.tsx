import type { ReactNode } from "react";

import Link from "next/link";

type AuthShellProps = {
  badge: string;
  title: string;
  description: string;
  footerLabel: string;
  footerHref: string;
  footerCta: string;
  children: ReactNode;
};

export function AuthShell({
  badge,
  title,
  description,
  footerLabel,
  footerHref,
  footerCta,
  children,
}: AuthShellProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="panel relative overflow-hidden rounded-[36px] border border-white/10 px-6 py-8 sm:px-10 sm:py-12">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />
          <p className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">{badge}</p>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            Учет цифровых активов в личном SaaS-кабинете.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300/80 sm:text-lg">
            {description}
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Режим</p>
              <p className="mt-3 text-lg font-medium text-white">Hosted SaaS</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Доступ</p>
              <p className="mt-3 text-lg font-medium text-white">Workspace roles</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Совместимость</p>
              <p className="mt-3 text-lg font-medium text-white">Legacy private mode</p>
            </div>
          </div>
        </section>

        <section className="panel rounded-[32px] border border-white/10 px-6 py-8 sm:px-8 sm:py-10">
          <h2 className="text-2xl font-semibold text-white">{title}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300/80">{description}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-8 text-sm text-slate-400">
            {footerLabel}{" "}
            <Link href={footerHref} className="font-medium text-cyan-200 transition hover:text-cyan-100">
              {footerCta}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
