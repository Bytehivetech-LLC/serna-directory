import { cn } from "@/lib/utils/cn";

export type SwatchProps = {
  label: string;
  cssVar: string;
  /** Literal Tailwind classes for the 100% / 40% / 10% cells (must be literal
   *  strings so Tailwind's content scanner keeps them). */
  full: string;
  forty: string;
  ten: string;
};

/**
 * One colour slot shown at 100%, 40%, and 10% opacity so a broken theme
 * variable is obvious at a glance.
 */
export function Swatch({ label, cssVar, full, forty, ten }: SwatchProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid h-16 grid-cols-3 text-[10px] font-semibold">
        <div className={cn("grid place-items-center", full)}>100</div>
        <div className={cn("grid place-items-center", forty)}>40</div>
        <div className={cn("grid place-items-center", ten)}>10</div>
      </div>
      <div className="bg-card px-2.5 py-2">
        <div className="text-xs font-semibold text-ink">{label}</div>
        <div className="font-mono text-[10px] text-muted-foreground">
          {cssVar}
        </div>
      </div>
    </div>
  );
}
