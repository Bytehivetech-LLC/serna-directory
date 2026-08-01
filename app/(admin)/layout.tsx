import Link from "next/link";

/**
 * Admin shell. Deliberately plainer than the public header — this is a staff
 * tool. `middleware.ts` ensures these routes only resolve on the admin
 * deployment (APP_TARGET=admin).
 */
export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="bg-header-bg text-header-text">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4 px-6 py-3.5">
          <Link
            href="/admin"
            className="flex items-center gap-2.5 text-header-text no-underline"
          >
            <span
              aria-hidden
              className="grid h-8 w-8 place-items-center rounded-[9px] bg-gradient-to-br from-violet to-indigo font-display text-sm font-extrabold text-white"
            >
              S
            </span>
            <span className="font-display text-sm font-bold">
              Serna Admin
            </span>
          </Link>
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-header-text/70">
            Staff console
          </span>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
