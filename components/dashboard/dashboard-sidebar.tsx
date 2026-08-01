"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, LayoutList, LogOut, UserRound } from "lucide-react";
import { signOutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils/cn";

const ITEMS = [
  { href: "/dashboard", label: "My listings", icon: LayoutList, exact: true },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/profile", label: "Profile", icon: UserRound },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="flex flex-row gap-1 md:flex-col" aria-label="Dashboard">
      {ITEMS.map(({ href, label, icon: Icon, exact }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(href, exact) ? "page" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold no-underline transition-colors",
            isActive(href, exact)
              ? "bg-secondary text-secondary-foreground"
              : "text-muted-foreground hover:bg-secondary/60 hover:text-ink",
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
          {label}
        </Link>
      ))}

      <form action={signOutAction} className="mt-1 md:mt-3">
        <button
          type="submit"
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out
        </button>
      </form>
    </nav>
  );
}
