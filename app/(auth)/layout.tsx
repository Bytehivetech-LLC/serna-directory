import Link from "next/link";

/** Focused, header-light shell for auth pages: brand mark + centred content. */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto flex w-full max-w-[1060px] items-center px-6 py-5">
        <Link
          href="/"
          className="flex items-center gap-2.5 no-underline"
          aria-label="Serna Educational Services home"
        >
          <span
            aria-hidden
            className="grid h-9 w-9 place-items-center rounded-[10px] bg-gradient-to-br from-violet to-indigo font-display text-[17px] font-extrabold text-white"
          >
            S
          </span>
          <span className="font-display text-base font-bold text-ink">
            Serna Educational Services
          </span>
        </Link>
      </div>
      <main className="flex flex-1 items-start justify-center px-6 pb-16 pt-4 sm:items-center">
        {children}
      </main>
    </div>
  );
}
