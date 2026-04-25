import { cn } from "@/lib/utils";

export function ChartSurfaceSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative h-[320px] w-full overflow-hidden rounded-[28px] border border-white/10",
        "bg-[linear-gradient(135deg,rgba(8,18,35,0.84),rgba(10,30,54,0.72))]",
        className,
      )}
    >
      <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_34%)]" />
      <div className="absolute inset-x-5 top-6 flex items-center gap-3">
        <div className="h-3 w-24 rounded-full bg-white/10" />
        <div className="h-3 w-16 rounded-full bg-white/5" />
      </div>
      <div className="absolute inset-x-5 bottom-6 top-20">
        <div className="absolute inset-0 grid grid-rows-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="border-t border-white/6" />
          ))}
        </div>
        <div className="absolute inset-x-2 bottom-0 flex items-end gap-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="flex-1 rounded-t-[18px] bg-gradient-to-t from-cyan-300/10 to-white/10"
              style={{ height: `${36 + ((index % 4) + 1) * 12}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
