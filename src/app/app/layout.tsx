import type { Metadata } from "next";

import { SaasAppShell } from "@/components/app/saas-app-shell";
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
  const context = await getCurrentUserWorkspaceContext(session.user.id);

  const workspaceName = context?.primaryWorkspace?.name ?? "Workspace not found";
  const workspaceRole = context?.primaryWorkspace?.role ?? "viewer";
  const userLabel =
    context?.user.displayName ?? session.user.displayName ?? session.user.email ?? "Unknown user";

  return (
    <SaasAppShell
      workspaceName={workspaceName}
      workspaceRole={workspaceRole}
      userLabel={userLabel}
    >
      {children}
    </SaasAppShell>
  );
}
