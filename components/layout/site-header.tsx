"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
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
  /** Wordmark text next to the logo mark. */
  brandName?: string;
  /** Where the wordmark links to (the public directory home by default). */
  homeHref?: string;
};

const DEFAULT_NAV: NavItem[] = [
  { label: "Directory", href: "/" },
  { label: "List your business", href: "/list-a-program" },
];

function Brand({ name, href }: { name: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 text-header-text no-underline"
    >
      <span
        aria-hidden
        className="grid h-9 w-9 place-items-center rounded-[10px] bg-gradient-to-br from-violet to-indigo font-display text-[17px] font-extrabold text-white"
      >
        S
      </span>
      <span className="font-display text-base font-bold">{name}</span>
    </Link>
  );
}

export function SiteHeader({
  nav = DEFAULT_NAV,
  activeHref,
  authed = false,
  brandName = "Serna Educational Services",
  homeHref = "/",
}: SiteHeaderProps) {
  const pathname = usePathname();
  const current = activeHref ?? pathname ?? "/";
  const isActive = (href: string) =>
    href === "/" ? current === "/" : current === href || current.startsWith(`${href}/`);

  return (
    <header className="bg-header-bg text-header-text">
      <div className="mx-auto flex max-w-[1060px] items-center justify-between gap-4 px-6 py-4">
        <Brand name={brandName} href={homeHref} />

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
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

        {/* Desktop actions */}
        <div className="hidden items-center gap-2 md:flex">
          {authed ? (
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
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
        <div className="md:hidden">
          <Sheet>
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
              <nav className="mt-6 flex flex-col gap-1">
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
