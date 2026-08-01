import { cn } from "@/lib/utils/cn";

export type SectionCardProps = React.ComponentProps<"section"> & {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned header actions. */
  actions?: React.ReactNode;
};

/**
 * The brand's white content card: 1px border, xl radius, soft card shadow.
 * Optional title/description header matches the reference `.card h2 / .sub`.
 */
export function SectionCard({
  title,
  description,
  actions,
  className,
  children,
  ...props
}: SectionCardProps) {
  const hasHeader = Boolean(title || description || actions);
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card p-6 shadow-card sm:p-[26px]",
        className,
      )}
      {...props}
    >
      {hasHeader ? (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title ? (
              <h2 className="font-display text-[19px] font-bold text-ink">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
