import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AuthPanel } from "@/components/dashboard/auth-panel";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  getDashboardAccess,
  getDashboardRoutePath,
} from "@/lib/auth/dashboard-auth";
import { getEnv } from "@/lib/env";
import { getPortfolioSnapshot } from "@/lib/portfolio/build-portfolio";

type DashboardPageProps = {
  params: Promise<{ dashboardSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Private Portfolio Dashboard",
    robots: {
      index: false,
      follow: false,
      nocache: true,
    },
  };
}

function LockedState({
  configured,
  routePath,
}: {
  configured: boolean;
  routePath: string;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4 py-8 sm:px-6">
      <SectionCard
        title="Private dashboard access"
        eyebrow="Token gate"
        description="This route exists, but the portfolio payload stays server-side until the request is authorized."
        className="w-full max-w-2xl"
      >
        <div className="space-y-6">
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-sm leading-7 text-slate-300/80">
            <p>
              Use the env-based dashboard token, or pass it as a query string token for a single request.
            </p>
            <p className="mt-3 text-cyan-100/80">
              API routes remain private and will not return portfolio data without a valid token or session cookie.
            </p>
          </div>
          <AuthPanel redirectTo={routePath} disabled={!configured} />
          {!configured ? (
            <div className="rounded-[24px] border border-amber-300/20 bg-amber-300/8 p-5 text-sm leading-7 text-amber-100/85">
              Configure <span className="font-mono">PRIVATE_DASHBOARD_SLUG</span> and <span className="font-mono">DASHBOARD_SECRET_TOKEN</span> in your env file before deploying this route.
            </div>
          ) : null}
        </div>
      </SectionCard>
    </main>
  );
}

export default async function DashboardPage({
  params,
  searchParams,
}: DashboardPageProps) {
  const [{ dashboardSlug }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const env = getEnv();

  if (dashboardSlug !== env.PRIVATE_DASHBOARD_SLUG) {
    notFound();
  }

  const routePath = getDashboardRoutePath(env.PRIVATE_DASHBOARD_SLUG);
  const access = await getDashboardAccess(resolvedSearchParams.token);

  if (!access.authorized) {
    return <LockedState configured={access.configured} routePath={routePath} />;
  }

  const snapshot = await getPortfolioSnapshot();
  return <DashboardShell snapshot={snapshot} />;
}
