"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { AvatarBadge } from "@/components/ui/avatar-badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";

export type NavItem = { label: string; href: string };

export type SiteHeaderProps = {
  /** Primary navigation, rendered left-of-centre on desktop and in the sheet on mobile. */
  nav?: NavItem[];
  /** The href of the current section, to highlight the active link. */
  activeHref?: string;
  /** When signed in, show Dashboard instead of Log in. */
  authed?: boolean;
  /** The signed-in user's avatar + name, for the account control. */
  avatarUrl?: string;
  userName?: string;
  /** Wordmark text next to the logo mark. */
  brandName?: string;
  /** Optional logo image; falls back to the mark letter. */
  logoUrl?: string;
  /** Admin-configured header logo height in px. */
  logoHeight?: number;
  /** Single letter shown in the gradient mark when there's no logo image. */
  markLetter?: string;
  /** Where the wordmark links to (the public directory home by default). */
  homeHref?: string;
};

const DEFAULT_NAV: NavItem[] = [
  { label: "Directory", href: "/" },
  { label: "List your business", href: "/list-a-program" },
];

function Brand({ name, href, logoUrl, markLetter, logoHeight = 32 }: { name: string; href: string; logoUrl?: string; markLetter: string; logoHeight?: number }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 text-header-text no-underline"
    >
      {logoUrl ? (
        // A real logo REPLACES the mark + wordmark — never both. Admin-set height,
        // width auto (keeps aspect ratio), explicit height attr → no layout shift.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={name}
          height={logoHeight}
          style={{ height: logoHeight }}
          className="w-auto max-w-[240px] object-contain"
        />
      ) : (
        <>
          <span
            aria-hidden
            className="grid h-9 w-9 place-items-center rounded-[10px] bg-gradient-to-br from-violet to-indigo font-display text-[17px] font-extrabold text-white"
          >
            {markLetter}
          </span>
          <span className="font-display text-base font-bold">{name}</span>
        </>
      )}
    </Link>
  );
}

/** Global directory search — jumps to /?q=… from any page. */
function HeaderSearch({
  className,
  onSubmitted,
}: {
  className?: string;
  onSubmitted?: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const query = q.trim();
        router.push(query ? `/?q=${encodeURIComponent(query)}` : "/");
        onSubmitted?.();
      }}
      className={cn("relative", className)}
    >
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60"
        aria-hidden
      />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search directory"
        aria-label="Search directory"
        className="h-9 w-44 rounded-full border border-white/15 bg-white/10 pl-9 pr-3 text-sm text-white placeholder:text-white/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
      />
    </form>
  );
}

export function SiteHeader({
  nav = DEFAULT_NAV,
  activeHref,
  authed = false,
  avatarUrl,
  userName,
  brandName = "Serna Educational Services",
  logoUrl,
  logoHeight,
  markLetter = "S",
  homeHref = "/",
}: SiteHeaderProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = activeHref ?? pathname ?? "/";
  const isActive = (href: string) =>
    href === "/" ? current === "/" : current === href || current.startsWith(`${href}/`);

  return (
    <header className="bg-header-bg text-header-text">
      <div className="mx-auto flex max-w-[var(--content-max)] items-center gap-4 px-6 py-3.5">
        <Brand name={brandName} href={homeHref} logoUrl={logoUrl} markLetter={markLetter} logoHeight={logoHeight} />

        {/* Desktop nav + search + actions */}
        <div className="ml-auto hidden items-center gap-5 md:flex">
          <nav className="flex items-center gap-6">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-xs font-semibold uppercase tracking-[0.08em] no-underline transition-colors",
                  isActive(item.href)
                    ? "border-b-2 border-violet pb-0.5 text-header-text"
                    : "text-header-text/70 hover:text-header-text",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <HeaderSearch />

          {authed ? (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-full py-0.5 pl-0.5 pr-3 text-sm font-semibold text-header-text no-underline transition-colors hover:bg-white/10"
              aria-label="Your dashboard"
            >
              <AvatarBadge url={avatarUrl} name={userName} size={30} />
              <span className="hidden lg:inline">Dashboard</span>
            </Link>
          ) : (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-header-text hover:bg-white/10 hover:text-header-text"
            >
              <Link href="/login">Log in</Link>
            </Button>
          )}
        </div>

        {/* Mobile menu */}
        <div className="ml-auto md:hidden">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open menu"
                className="text-header-text hover:bg-white/10 hover:text-header-text"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader className="text-left">
                <SheetTitle className="font-display">{brandName}</SheetTitle>
              </SheetHeader>

              <div className="mt-5 rounded-full bg-header-bg p-1">
                <HeaderSearch
                  className="[&_input]:w-full"
                  onSubmitted={() => setMenuOpen(false)}
                />
              </div>

              <nav className="mt-4 flex flex-col gap-1">
                {nav.map((item) => (
                  <SheetClose asChild key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "rounded-lg px-3 py-2.5 text-sm font-semibold no-underline",
                        isActive(item.href)
                          ? "bg-secondary text-secondary-foreground"
                          : "text-ink hover:bg-secondary/60",
                      )}
                    >
                      {item.label}
                    </Link>
                  </SheetClose>
                ))}
                <div className="mt-4 border-t border-border pt-4">
                  <SheetClose asChild>
                    <Button asChild className="w-full">
                      <Link href={authed ? "/dashboard" : "/login"}>
                        {authed ? "Dashboard" : "Log in"}
                      </Link>
                    </Button>
                  </SheetClose>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
