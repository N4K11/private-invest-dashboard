import type { Metadata } from "next";

import Link from "next/link";

import { ImportCenter } from "@/components/app/import-center";
import { DashboardStatePanel } from "@/components/dashboard/dashboard-state-panel";
import { getActiveWorkspaceSlug } from "@/lib/auth/active-workspace";
import { requireAppSession } from "@/lib/auth/session";
import { getCurrentUserWorkspaceContext } from "@/lib/auth/workspace";
import { getManualTemplateCsv } from "@/lib/imports/preview";
import { listPortfoliosForWorkspace } from "@/lib/saas/portfolios";

export const metadata: Metadata = {
  title: "Import Center",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ImportPage() {
  const session = await requireAppSession();
  const activeWorkspaceSlug = await getActiveWorkspaceSlug();
  const context = await getCurrentUserWorkspaceContext(session.user.id, {
    preferredWorkspaceSlug: activeWorkspaceSlug ?? session.user.workspaceSlug ?? null,
  });
  const workspace = context?.primaryWorkspace;

  if (!workspace) {
    return (
      <DashboardStatePanel
        eyebrow="Нет workspace"
        title="Import Center недоступен без активного workspace"
        description="Сначала создайте или выберите workspace на SaaS home, затем вернитесь сюда для preview и импорта."
        action={
          <Link
            href="/app"
            className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            Вернуться в SaaS home
          </Link>
        }
      />
    );
  }

  const portfolios = await listPortfoliosForWorkspace(session.user.id, workspace.id);

  return (
    <ImportCenter
      workspaceName={workspace.name}
      portfolios={portfolios}
      canManage={workspace.role === "owner" || workspace.role === "admin"}
      manualTemplateCsv={getManualTemplateCsv()}
    />
  );
}
