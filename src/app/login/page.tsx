import type { Metadata } from "next";

import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { SaasDisabledState } from "@/components/auth/saas-disabled-state";
import { getAppSession } from "@/lib/auth/session";
import { isSaasAuthConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Вход",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function LoginPage() {
  const session = await getAppSession();

  if (session?.user?.id) {
    redirect("/app");
  }

  const isConfigured = isSaasAuthConfigured();

  return (
    <AuthShell
      badge="SaaS access"
      title="Вход в аккаунт"
      description="Вход в hosted SaaS mode с email и паролем. Legacy private dashboard по slug+token продолжает работать отдельно."
      footerLabel="Еще нет аккаунта?"
      footerHref="/register"
      footerCta="Создать"
    >
      {isConfigured ? <LoginForm disabled={false} /> : <SaasDisabledState />}
    </AuthShell>
  );
}
