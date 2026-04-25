import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DashboardLockedState } from "@/components/dashboard/dashboard-locked-state";
import { SettingsHealthShell } from "@/components/dashboard/settings-health-shell";
import {
  getDashboardAccess,
  getDashboardSettingsPath,
} from "@/lib/auth/dashboard-auth";
import { getEnv } from "@/lib/env";
import { getDashboardHealthSnapshot } from "@/lib/health/dashboard-health";

type SettingsPageProps = {
  params: Promise<{ dashboardSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Settings / Health",
    robots: {
      index: false,
      follow: false,
      nocache: true,
    },
  };
}

export default async function DashboardSettingsPage({
  params,
  searchParams,
}: SettingsPageProps) {
  const [{ dashboardSlug }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const env = getEnv();

  if (dashboardSlug !== env.PRIVATE_DASHBOARD_SLUG) {
    notFound();
  }

  const routePath = getDashboardSettingsPath(env.PRIVATE_DASHBOARD_SLUG);
  const access = await getDashboardAccess(resolvedSearchParams.token);

  if (!access.authorized) {
    return (
      <DashboardLockedState
        configured={access.configured}
        routePath={routePath}
        title="Приватный доступ к Settings / Health"
        description="Диагностика dashboard так же закрыта token-gate и не показывает operational data без авторизации."
      />
    );
  }

  const health = await getDashboardHealthSnapshot();
  return <SettingsHealthShell initialHealth={health} dashboardSlug={dashboardSlug} />;
}
