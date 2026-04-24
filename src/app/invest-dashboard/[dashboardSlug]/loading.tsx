export default function DashboardLoading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1640px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="panel h-64 animate-pulse rounded-[34px] border border-white/10" />
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="panel h-40 animate-pulse rounded-[28px] border border-white/10"
          />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="panel h-[420px] animate-pulse rounded-[30px] border border-white/10"
          />
        ))}
      </div>
    </main>
  );
}
