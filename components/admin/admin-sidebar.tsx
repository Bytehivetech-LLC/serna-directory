"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  LayoutList,
  Users,
  Package,
  PackagePlus,
  ClipboardList,
  Tags,
  FormInput,
  CreditCard,
  Mail,
  Settings,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/listings", label: "Listings", icon: LayoutList },
  { href: "/admin/fulfilment", label: "Fulfilment", icon: ClipboardList },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/packages", label: "Packages", icon: Package },
  { href: "/admin/addons", label: "Add-ons", icon: PackagePlus },
  { href: "/admin/taxonomy", label: "Categories & Tags", icon: Tags },
  { href: "/admin/form-builder", label: "Form builder", icon: FormInput },
  { href: "/admin/emails", label: "Emails", icon: Mail },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      className="flex flex-row gap-1 overflow-x-auto md:flex-col md:gap-0.5"
      aria-label="Admin"
    >
      {ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = isActive(href, exact);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold no-underline transition-colors",
              active
                ? "bg-sidebar-active-bg text-sidebar-active-text"
                : "text-sidebar-text/70 hover:bg-sidebar-active-bg/40 hover:text-sidebar-text",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
