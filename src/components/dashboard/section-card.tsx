import { cn } from "@/lib/utils";

type SectionCardProps = React.PropsWithChildren<{
  title: string;
  eyebrow?: string;
  description?: string;
  className?: string;
  contentClassName?: string;
  aside?: React.ReactNode;
}>;

export function SectionCard({
  title,
  eyebrow,
  description,
  className,
  contentClassName,
  aside,
  children,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "panel rounded-[28px] border border-white/10 px-5 py-5 shadow-[0_20px_70px_rgba(2,8,23,0.5)] sm:px-6",
        className,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          {eyebrow ? (
            <p className="text-[0.65rem] uppercase tracking-[0.32em] text-cyan-200/60">
              {eyebrow}
            </p>
          ) : null}
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-white">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 max-w-2xl text-sm text-slate-300/70">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      <div className={cn("mt-6", contentClassName)}>{children}</div>
    </section>
  );
}
