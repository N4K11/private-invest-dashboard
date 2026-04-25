import { cn } from "@/lib/utils";

type DashboardStatePanelProps = {
  eyebrow?: string;
  title: string;
  description: string;
  tone?: "neutral" | "warning" | "error" | "success";
  className?: string;
  contentClassName?: string;
  action?: React.ReactNode;
};

const toneStyles: Record<
  NonNullable<DashboardStatePanelProps["tone"]>,
  {
    border: string;
    glow: string;
    eyebrow: string;
  }
> = {
  neutral: {
    border: "border-white/10 bg-white/[0.035]",
    glow: "from-cyan-300/12 via-transparent to-blue-300/8",
    eyebrow: "text-cyan-200/60",
  },
  warning: {
    border: "border-amber-300/18 bg-amber-300/[0.06]",
    glow: "from-amber-300/16 via-transparent to-orange-300/10",
    eyebrow: "text-amber-200/80",
  },
  error: {
    border: "border-rose-400/18 bg-rose-400/[0.06]",
    glow: "from-rose-400/18 via-transparent to-fuchsia-400/10",
    eyebrow: "text-rose-200/80",
  },
  success: {
    border: "border-emerald-400/18 bg-emerald-400/[0.06]",
    glow: "from-emerald-300/16 via-transparent to-cyan-300/10",
    eyebrow: "text-emerald-200/80",
  },
};

export function DashboardStatePanel({
  eyebrow,
  title,
  description,
  tone = "neutral",
  className,
  contentClassName,
  action,
}: DashboardStatePanelProps) {
  const palette = toneStyles[tone];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[28px] border px-6 py-8",
        "flex min-h-[220px] items-center justify-center text-center",
        palette.border,
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90",
          palette.glow,
        )}
      />
      <div className={cn("relative max-w-md", contentClassName)}>
        <p className={cn("text-[0.65rem] uppercase tracking-[0.32em]", palette.eyebrow)}>
          {eyebrow ?? "Состояние данных"}
        </p>
        <h3 className="mt-3 text-lg font-semibold text-white sm:text-xl">{title}</h3>
        <p className="mt-3 text-sm leading-6 text-slate-300/78">{description}</p>
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}
