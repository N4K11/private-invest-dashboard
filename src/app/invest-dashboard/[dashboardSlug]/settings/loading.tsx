import { ChartSurfaceSkeleton } from "@/components/dashboard/chart-surface-skeleton";

export default function DashboardSettingsLoading() {
  return (
    <main className="relative overflow-hidden pb-16">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <section className="panel relative overflow-hidden rounded-[34px] border border-white/10 px-5 py-6 sm:px-7 sm:py-7 lg:px-8">
          <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_top_left,rgba(0,209,160,0.1),transparent_34%),radial-gradient(circle_at_top_right,rgba(61,139,255,0.12),transparent_38%)]" />
          <div className="relative space-y-5">
            <div className="flex flex-wrap gap-3">
              <div className="h-8 w-36 rounded-full bg-white/10" />
              <div className="h-8 w-52 rounded-full bg-white/8" />
            </div>
            <div className="space-y-4">
              <div className="h-12 max-w-3xl rounded-[28px] bg-white/10" />
              <div className="h-4 w-full max-w-4xl rounded-full bg-white/6" />
              <div className="h-4 w-5/6 max-w-3xl rounded-full bg-white/6" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-12 rounded-2xl bg-white/8" />
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="panel rounded-[28px] border border-white/10 px-4 py-5">
              <div className="h-3 w-20 rounded-full bg-white/10" />
              <div className="mt-4 h-10 rounded-[24px] bg-white/8" />
              <div className="mt-4 h-3 w-full rounded-full bg-white/6" />
              <div className="mt-2 h-3 w-2/3 rounded-full bg-white/6" />
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="panel rounded-[30px] border border-white/10 px-4 py-5 sm:px-6">
            <div className="mb-5 space-y-3">
              <div className="h-3 w-28 rounded-full bg-white/10" />
              <div className="h-8 w-56 rounded-2xl bg-white/10" />
              <div className="h-3 w-full max-w-md rounded-full bg-white/6" />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-[24px] border border-white/8 bg-white/[0.035] p-4">
                  <div className="h-4 w-28 rounded-full bg-white/10" />
                  <div className="mt-3 h-3 w-32 rounded-full bg-white/6" />
                  <div className="mt-4 space-y-2">
                    <div className="h-3 w-full rounded-full bg-white/6" />
                    <div className="h-3 w-2/3 rounded-full bg-white/6" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="panel rounded-[30px] border border-white/10 px-4 py-5 sm:px-6">
            <div className="mb-5 space-y-3">
              <div className="h-3 w-24 rounded-full bg-white/10" />
              <div className="h-8 w-44 rounded-2xl bg-white/10" />
              <div className="h-3 w-full max-w-md rounded-full bg-white/6" />
            </div>
            <ChartSurfaceSkeleton />
          </div>
        </div>
      </div>
    </main>
  );
}
