import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { signOutAction } from "@/lib/auth/actions";
import { getSettings } from "@/lib/settings";
import { getAdminTheme } from "@/lib/theme/get-theme";
import { toAdminCssVars } from "@/lib/theme/to-css-vars";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

/**
 * Admin shell. `requireAdmin()` here 403s non-admins before any admin page
 * renders — but note a layout check is NOT sufficient on its own: every admin
 * server action must call requireAdmin() again. `middleware.ts` also ensures
 * these routes only resolve on the admin deployment (APP_TARGET=admin) and
 * 404 entirely on the public one.
 *
 * The admin panel has its OWN theme (admin_theme), injected here scoped to
 * `.admin-shell` so it overrides the public theme within the admin subtree only.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, profile } = await requireAdmin();
  const email = profile?.email ?? user.email ?? "admin";

  const [adminTheme, settings] = await Promise.all([
    getAdminTheme(),
    getSettings(["site_name", "admin_logo_url", "logo_url", "logo_mark_letter"]),
  ]);
  const adminCss = toAdminCssVars(adminTheme, ".admin-shell");

  const brandName =
    typeof settings.site_name === "string" && settings.site_name
      ? settings.site_name
      : "Serna";
  // Separate admin logo → falls back to the public logo → then the letter mark.
  const brandLogo =
    (typeof settings.admin_logo_url === "string" && settings.admin_logo_url) ||
    (typeof settings.logo_url === "string" && settings.logo_url) ||
    "";
  const markLetter =
    typeof settings.logo_mark_letter === "string" && settings.logo_mark_letter
      ? settings.logo_mark_letter
      : brandName.slice(0, 1).toUpperCase();

  return (
    <div className="admin-shell flex min-h-screen flex-col bg-bg md:flex-row">
      <style id="admin-theme-vars" dangerouslySetInnerHTML={{ __html: adminCss }} />

      {/* Sidebar — themed via admin_theme. */}
      <aside className="flex flex-col bg-sidebar-bg text-sidebar-text md:w-60 md:shrink-0">
        <div className="flex items-center justify-between gap-2 bg-brand-bar-bg px-4 py-4 text-brand-bar-text">
          <Link href="/admin" className="flex items-center gap-2.5 text-brand-bar-text no-underline">
            {brandLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brandLogo} alt={brandName} height={28} className="h-7 w-auto max-w-[150px] object-contain" />
            ) : (
              <>
                <span
                  aria-hidden
                  className="grid h-8 w-8 place-items-center rounded-[9px] bg-gradient-to-br from-violet to-indigo font-display text-sm font-extrabold text-white"
                >
                  {markLetter}
                </span>
                <span className="font-display text-sm font-bold">{brandName}</span>
              </>
            )}
          </Link>
          {/* The ADMIN marker stays visible regardless of theme — fixed violet
              on white so no admin_theme choice can hide it. */}
          <span className="rounded-md bg-violet px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-white ring-1 ring-white/25">
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
