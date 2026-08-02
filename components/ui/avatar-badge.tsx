import { cn } from "@/lib/utils/cn";

function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

/**
 * A user's avatar, or their initials on violet-soft when there's no picture.
 * Used in the site header, dashboard sidebar, and admin user views — NOT on
 * public listing pages.
 */
export function AvatarBadge({
  url,
  name,
  size = 32,
  className,
}: {
  url?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={cn("shrink-0 rounded-full object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full bg-violet-soft font-semibold text-violet",
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
