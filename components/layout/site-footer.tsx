import Link from "next/link";
import type { NavItem } from "./site-header";
import { ConsentReopenLink } from "@/components/consent/consent-banner";

export type SiteFooterProps = {
  nav?: NavItem[];
  brandName?: string;
  markLetter?: string;
  /** Optional logo image; when present it REPLACES the mark + wordmark. */
  logoUrl?: string;
  footerText?: string;
};

const DEFAULT_FOOTER_NAV: NavItem[] = [
  { label: "Directory", href: "/" },
  { label: "List your business", href: "/list-a-program" },
  { label: "Log in", href: "/login" },
];

export function SiteFooter({
  nav = DEFAULT_FOOTER_NAV,
  brandName = "Serna Educational Services",
  markLetter = "S",
  logoUrl,
  footerText,
}: SiteFooterProps) {
  const year = 2026;
  return (
    <footer className="mt-auto border-t border-border bg-card">
      <div className="mx-auto flex max-w-[1060px] flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          {logoUrl ? (
            // Logo REPLACES the mark + wordmark — never both. 28px tall.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={brandName}
              height={28}
              className="h-7 w-auto max-w-[180px] object-contain"
            />
          ) : (
            <>
              <span
                aria-hidden
                className="grid h-8 w-8 place-items-center rounded-[9px] bg-gradient-to-br from-violet to-indigo font-display text-sm font-extrabold text-white"
              >
                {markLetter}
              </span>
              <span className="font-display text-sm font-bold text-ink">{brandName}</span>
            </>
          )}
        </div>

        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-muted-foreground no-underline transition-colors hover:text-indigo"
            >
              {item.label}
            </Link>
          ))}
          <ConsentReopenLink className="text-sm font-medium text-muted-foreground transition-colors hover:text-indigo" />
        </nav>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-[1060px] px-6 py-4 text-xs text-faint">
          {footerText && footerText.trim()
            ? footerText
            : `© ${year} ${brandName}. Arizona homeschool & education directory.`}
        </p>
      </div>
    </footer>
  );
}
