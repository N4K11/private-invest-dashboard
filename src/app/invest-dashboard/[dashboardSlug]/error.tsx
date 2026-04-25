"use client";

export default function DashboardError({
  reset,
}: {
  reset: () => void;
}) {
  return (
    <main className="relative overflow-hidden pb-16">
      <div className="mx-auto flex min-h-screen w-full max-w-[1120px] items-center px-4 py-8 sm:px-6 lg:px-8">
        <section className="panel relative w-full overflow-hidden rounded-[34px] border border-rose-400/16 px-6 py-8 shadow-[0_30px_100px_rgba(2,8,23,0.72)] sm:px-8 sm:py-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_40%),linear-gradient(120deg,rgba(255,255,255,0.02),transparent_45%)]" />
          <div className="relative max-w-3xl">
            <p className="text-[0.68rem] uppercase tracking-[0.32em] text-rose-200/72">Route-level error</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-[2.7rem]">
              Dashboard временно не смог собрать данные
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-300/82 sm:text-base">
              Ошибка перехвачена внутри приватного сегмента, поэтому секретный route и token-gate не раскрываются. Обычно достаточно повторить запрос или перезагрузить страницу после восстановления источника данных.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={reset}
                className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/16"
              >
                Повторить загрузку
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/8"
              >
                Перезагрузить страницу
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
