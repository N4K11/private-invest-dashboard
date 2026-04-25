import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DashboardLockedState } from "@/components/dashboard/dashboard-locked-state";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
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
    title: "Приватный инвестиционный терминал",
    robots: {
      index: false,
      follow: false,
      nocache: true,
    },
  };
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
    return <DashboardLockedState configured={access.configured} routePath={routePath} />;
  }

  const snapshot = await getPortfolioSnapshot();
  return <DashboardShell snapshot={snapshot} dashboardSlug={dashboardSlug} />;
}
