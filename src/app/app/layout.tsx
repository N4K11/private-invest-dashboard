import type { Metadata } from "next";

import { SaasAppShell } from "@/components/app/saas-app-shell";
import { WorkspaceSwitcher } from "@/components/app/workspace-switcher";
import { getActiveWorkspaceSlug } from "@/lib/auth/active-workspace";
import { requireAppSession } from "@/lib/auth/session";
import { getCurrentUserWorkspaceContext } from "@/lib/auth/workspace";

export const metadata: Metadata = {
  title: "SaaS кабинет",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SaasLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireAppSession();
  const activeWorkspaceSlug = await getActiveWorkspaceSlug();
  const context = await getCurrentUserWorkspaceContext(session.user.id, {
    preferredWorkspaceSlug: activeWorkspaceSlug ?? session.user.workspaceSlug ?? null,
  });

  const workspaceName = context?.primaryWorkspace?.name ?? "Без активного workspace";
  const workspaceRole = context?.primaryWorkspace?.role ?? "viewer";
  const userLabel =
    context?.user.displayName ?? session.user.displayName ?? session.user.email ?? "Unknown user";

  return (
    <SaasAppShell
      workspaceName={workspaceName}
      workspaceRole={workspaceRole}
      userLabel={userLabel}
      workspaceSwitcher={
        context?.memberships?.length ? (
          <WorkspaceSwitcher
            memberships={context.memberships}
            activeWorkspaceSlug={context.primaryWorkspace?.slug ?? activeWorkspaceSlug}
          />
        ) : undefined
      }
    >
      {children}
    </SaasAppShell>
  );
}
