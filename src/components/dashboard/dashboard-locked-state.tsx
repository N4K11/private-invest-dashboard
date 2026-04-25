import { AuthPanel } from "@/components/dashboard/auth-panel";
import { SectionCard } from "@/components/dashboard/section-card";

export function DashboardLockedState({
  configured,
  routePath,
  title = "Приватный доступ к терминалу",
  description = "Маршрут существует, но данные портфеля остаются на сервере до успешной авторизации.",
}: {
  configured: boolean;
  routePath: string;
  title?: string;
  description?: string;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4 py-8 sm:px-6">
      <SectionCard
        title={title}
        eyebrow="Токен-защита"
        description={description}
        className="w-full max-w-2xl"
      >
        <div className="space-y-6">
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-sm leading-7 text-slate-300/80">
            <p>
              Используй секретный токен из env или передай его в query string для одноразового входа.
            </p>
            <p className="mt-3 text-cyan-100/80">
              Закрытый API не отдаст данные без валидного токена или session-cookie.
            </p>
          </div>
          <AuthPanel redirectTo={routePath} disabled={!configured} />
          {!configured ? (
            <div className="rounded-[24px] border border-amber-300/20 bg-amber-300/8 p-5 text-sm leading-7 text-amber-100/85">
              Настрой <span className="font-mono">PRIVATE_DASHBOARD_SLUG</span> и <span className="font-mono">DASHBOARD_SECRET_TOKEN</span> в env перед публикацией этого маршрута.
            </div>
          ) : null}
        </div>
      </SectionCard>
    </main>
  );
}
