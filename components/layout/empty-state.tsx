import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  /** A call to action — empty states should always invite the next step. */
  action?: React.ReactNode;
  className?: string;
};

/**
 * A friendly empty state. Always give it an `action` where one makes sense —
 * an empty screen should point the way forward, not dead-end.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-card px-6 py-14 text-center",
        className,
      )}
    >
      {Icon ? (
        <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-secondary text-violet">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
      ) : null}
      <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
