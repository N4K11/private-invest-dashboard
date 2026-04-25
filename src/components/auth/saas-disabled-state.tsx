export function SaasDisabledState() {
  return (
    <div className="rounded-3xl border border-amber-300/25 bg-amber-300/10 px-5 py-4 text-sm leading-7 text-amber-50/90">
      SaaS-авторизация пока не активирована на этом окружении. Для запуска нужны `DATABASE_URL` и `AUTH_SECRET`, после чего можно выполнить Prisma migrate и открыть регистрацию.
    </div>
  );
}
