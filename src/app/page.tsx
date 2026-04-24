export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <section className="panel w-full rounded-[36px] border border-white/10 px-6 py-10 sm:px-10 sm:py-14">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.34em] text-cyan-200/65">
            Приватная инфраструктура
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            На этом домене работают внутренние сервисы и закрытые операторские интерфейсы.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300/80">
            Публичная навигация не раскрывает приватные маршруты, а чувствительные данные остаются за отдельными точками доступа и токен-защитой.
          </p>
        </div>
      </section>
    </main>
  );
}

