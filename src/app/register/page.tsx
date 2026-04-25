import type { Metadata } from "next";

import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { SaasDisabledState } from "@/components/auth/saas-disabled-state";
import { getAppSession } from "@/lib/auth/session";
import { isSaasAuthConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Регистрация",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function RegisterPage() {
  const session = await getAppSession();

  if (session?.user?.id) {
    redirect("/app");
  }

  const isConfigured = isSaasAuthConfigured();

  return (
    <AuthShell
      badge="SaaS onboarding"
      title="Создание аккаунта"
      description="Регистрация создает пользователя, owner-workspace и главный портфель в PostgreSQL, не затрагивая текущий private dashboard."
      footerLabel="Уже есть аккаунт?"
      footerHref="/login"
      footerCta="Войти"
    >
      {isConfigured ? <RegisterForm disabled={false} /> : <SaasDisabledState />}
    </AuthShell>
  );
}
