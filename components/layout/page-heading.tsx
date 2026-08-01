import { cn } from "@/lib/utils/cn";

export type PageHeadingProps = {
  title: string;
  /** Supporting sentence under the title. Accepts rich content for emphasis. */
  lede?: React.ReactNode;
  /** Optional right-aligned actions (buttons, links). */
  actions?: React.ReactNode;
  /** Small eyebrow label above the title. */
  eyebrow?: string;
  className?: string;
};

/**
 * The standard page title block: display-font h1, optional lede and actions.
 */
export function PageHeading({
  title,
  lede,
  actions,
  eyebrow,
  className,
}: PageHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-violet">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-3xl font-extrabold leading-[1.08] tracking-[-0.015em] text-ink sm:text-4xl">
          {title}
        </h1>
        {lede ? (
          <p className="mt-3.5 text-base text-muted-foreground [&_b]:text-ink [&_strong]:text-ink">
            {lede}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  );
}
