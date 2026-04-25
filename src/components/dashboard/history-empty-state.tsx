type HistoryEmptyStateProps = {
  title: string;
  description: string;
};

export function HistoryEmptyState({ title, description }: HistoryEmptyStateProps) {
  return (
    <div className="flex h-[320px] items-center justify-center rounded-[28px] border border-dashed border-white/10 bg-white/[0.035] px-6 text-center">
      <div className="max-w-sm">
        <p className="text-[0.65rem] uppercase tracking-[0.32em] text-cyan-200/60">Portfolio History пуст</p>
        <h3 className="mt-3 text-lg font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-300/76">{description}</p>
      </div>
    </div>
  );
}
