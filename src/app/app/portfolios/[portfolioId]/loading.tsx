export default function PortfolioDetailLoading() {
  return (
    <main className="space-y-6 animate-pulse">
      <section className="panel h-[220px] rounded-[32px] border border-white/10 bg-white/[0.04]" />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="panel h-[150px] rounded-[28px] border border-white/10 bg-white/[0.04]"
          />
        ))}
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <div className="panel h-[420px] rounded-[32px] border border-white/10 bg-white/[0.04]" />
        <div className="panel h-[420px] rounded-[32px] border border-white/10 bg-white/[0.04]" />
      </section>
      <section className="panel h-[520px] rounded-[32px] border border-white/10 bg-white/[0.04]" />
    </main>
  );
}
