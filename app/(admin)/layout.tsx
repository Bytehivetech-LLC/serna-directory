import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { signOutAction } from "@/lib/auth/actions";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

/**
 * Admin shell. `requireAdmin()` here 403s non-admins before any admin page
 * renders — but note a layout check is NOT sufficient on its own: every admin
 * server action must call requireAdmin() again. `middleware.ts` also ensures
 * these routes only resolve on the admin deployment (APP_TARGET=admin) and
 * 404 entirely on the public one.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, profile } = await requireAdmin();
  const email = profile?.email ?? user.email ?? "admin";

  return (
    <div className="flex min-h-screen flex-col bg-bg md:flex-row">
      {/* Sidebar — dark indigo-deep, dense. */}
      <aside className="flex flex-col bg-indigo-deep text-white md:w-60 md:shrink-0">
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          <Link
            href="/admin"
            className="flex items-center gap-2.5 text-white no-underline"
          >
            <span
              aria-hidden
              className="grid h-8 w-8 place-items-center rounded-[9px] bg-gradient-to-br from-violet to-indigo font-display text-sm font-extrabold text-white"
            >
              S
            </span>
            <span className="font-display text-sm font-bold">Serna</span>
          </Link>
          <span className="rounded-md bg-violet px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-white">
            Admin
          </span>
        </div>
        <div className="px-3 pb-4 md:flex-1">
          <AdminSidebar />
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-border bg-card px-5 py-3">
          <div className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-violet">
              Staff console
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="hidden max-w-[220px] truncate text-sm text-muted-foreground sm:inline"
              title={email}
            >
              {email}
            </span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-secondary"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Sign out
              </button>
            </form>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-5 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
