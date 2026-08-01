import { cn } from "@/lib/utils/cn";

export type PageContainerProps = React.ComponentProps<"div"> & {
  /** "default" ~1060px for listings/dashboards, "narrow" ~720px for forms & prose. */
  width?: "default" | "narrow";
};

/**
 * Centres page content and applies the standard gutters. Responsive to 360px
 * via the px-6 gutter.
 */
export function PageContainer({
  width = "default",
  className,
  children,
  ...props
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-6",
        width === "narrow" ? "max-w-[720px]" : "max-w-[1060px]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
