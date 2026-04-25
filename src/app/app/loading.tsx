export default function AppLoading() {
  return (
    <main className="space-y-6 animate-pulse">
      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel h-[280px] rounded-[32px] border border-white/10 bg-white/[0.04]" />
        <div className="panel h-[280px] rounded-[32px] border border-white/10 bg-white/[0.04]" />
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="panel h-[150px] rounded-[28px] border border-white/10 bg-white/[0.04]"
          />
        ))}
      </section>
      <section className="panel h-[420px] rounded-[32px] border border-white/10 bg-white/[0.04]" />
    </main>
  );
}
