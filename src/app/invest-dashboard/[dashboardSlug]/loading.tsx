import { ChartSurfaceSkeleton } from "@/components/dashboard/chart-surface-skeleton";

function SummarySkeletonCard() {
  return (
    <div className="panel relative overflow-hidden rounded-[28px] border border-white/10 px-4 py-5">
      <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.1),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.08),transparent_38%)]" />
      <div className="relative space-y-4">
        <div className="h-3 w-28 rounded-full bg-white/10" />
        <div className="h-9 w-36 rounded-2xl bg-white/10" />
        <div className="h-3 w-full rounded-full bg-white/5" />
        <div className="h-3 w-2/3 rounded-full bg-white/5" />
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="panel relative overflow-hidden rounded-[30px] border border-white/10 px-4 py-5 sm:px-6">
      <div className="absolute inset-0 animate-pulse bg-[linear-gradient(135deg,rgba(8,18,35,0.76),rgba(10,28,48,0.64))]" />
      <div className="relative space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <div className="h-3 w-20 rounded-full bg-white/10" />
                <div className="h-12 rounded-2xl bg-white/8" />
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <div className="h-10 w-28 rounded-full bg-white/8" />
            <div className="h-10 w-28 rounded-full bg-white/8" />
          </div>
        </div>
        <div className="rounded-[24px] border border-white/8 bg-white/[0.035] p-4">
          <div className="grid grid-cols-9 gap-3 border-b border-white/8 pb-3">
            {Array.from({ length: 9 }).map((_, index) => (
              <div key={index} className="h-3 rounded-full bg-white/10" />
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {Array.from({ length: 6 }).map((_, row) => (
              <div key={row} className="grid grid-cols-9 gap-3">
                {Array.from({ length: 9 }).map((_, cell) => (
                  <div key={cell} className="h-10 rounded-2xl bg-white/6" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <main className="relative overflow-hidden pb-16">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <section className="panel relative overflow-hidden rounded-[34px] border border-white/10 px-5 py-6 sm:px-7 sm:py-7 lg:px-8">
          <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_top_left,rgba(0,209,160,0.12),transparent_34%),radial-gradient(circle_at_top_right,rgba(61,139,255,0.12),transparent_38%),linear-gradient(120deg,rgba(255,255,255,0.02),transparent_45%)]" />
          <div className="relative grid gap-8 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
            <div className="space-y-5">
              <div className="flex flex-wrap gap-3">
                <div className="h-8 w-48 rounded-full bg-white/10" />
                <div className="h-8 w-32 rounded-full bg-white/8" />
                <div className="h-8 w-28 rounded-full bg-white/8" />
              </div>
              <div className="space-y-4">
                <div className="h-6 w-40 rounded-full bg-white/10" />
                <div className="h-14 max-w-3xl rounded-[28px] bg-white/10" />
                <div className="h-4 w-full max-w-4xl rounded-full bg-white/6" />
                <div className="h-4 w-5/6 max-w-3xl rounded-full bg-white/6" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-16 rounded-[24px] bg-white/8" />
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-[26px] border border-white/10 bg-white/[0.045] p-4">
                  <div className="h-3 w-20 rounded-full bg-white/10" />
                  <div className="mt-4 h-9 w-32 rounded-2xl bg-white/10" />
                  <div className="mt-4 h-3 w-full rounded-full bg-white/5" />
                  <div className="mt-2 h-3 w-2/3 rounded-full bg-white/5" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <SummarySkeletonCard key={index} />
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="panel rounded-[30px] border border-white/10 px-4 py-5 sm:px-6">
              <div className="mb-5 space-y-3">
                <div className="h-3 w-28 rounded-full bg-white/10" />
                <div className="h-8 w-52 rounded-2xl bg-white/10" />
                <div className="h-3 w-full max-w-md rounded-full bg-white/6" />
              </div>
              <ChartSurfaceSkeleton />
            </div>
          ))}
        </div>

        <TableSkeleton />
      </div>
    </main>
  );
}
