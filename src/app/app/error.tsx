"use client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="panel rounded-[32px] border border-rose-400/20 bg-rose-400/10 px-6 py-8 sm:px-8">
      <p className="text-xs uppercase tracking-[0.34em] text-rose-200/80">SaaS app error</p>
      <h2 className="mt-3 text-3xl font-semibold text-white">Не удалось загрузить SaaS-раздел</h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-rose-50/85">
        {error.message || "Произошла непредвиденная ошибка при загрузке workspace или портфеля."}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
      >
        Повторить загрузку
      </button>
    </main>
  );
}
