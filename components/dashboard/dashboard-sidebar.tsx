"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  LayoutDashboard,
  LayoutList,
  LogOut,
  UserRound,
} from "lucide-react";
import { signOutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils/cn";
import { AvatarBadge } from "@/components/ui/avatar-badge";

const ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/listings", label: "Listings", icon: LayoutList },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/profile", label: "Profile", icon: UserRound },
];

export function DashboardSidebar({
  avatarUrl,
  name,
  email,
}: {
  avatarUrl?: string | null;
  name?: string | null;
  email?: string | null;
}) {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="flex flex-row gap-1 md:flex-col" aria-label="Dashboard">
      <div className="mb-2 hidden items-center gap-2.5 px-3 py-2 md:flex">
        <AvatarBadge url={avatarUrl} name={name ?? email} size={36} />
        <div className="min-w-0">
          {name ? <p className="truncate text-sm font-semibold text-ink">{name}</p> : null}
          {email ? <p className="truncate text-xs text-muted-foreground">{email}</p> : null}
        </div>
      </div>

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
