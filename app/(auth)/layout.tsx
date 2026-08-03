import Link from "next/link";
import { getSettings } from "@/lib/settings";

/**
 * Focused, header-light shell for /login, /register, /forgot-password and
 * /reset-password. The brand sits ABOVE the card, horizontally centred, and a
 * real logo REPLACES the mark + wordmark (same rule as the site header).
 */
export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const settings = await getSettings([
    "site_name",
    "logo_url",
    "logo_mark_letter",
    "logo_height_auth",
  ]);
  const logoHeight =
    typeof settings.logo_height_auth === "number" ? settings.logo_height_auth : 40;
  const brandName =
    typeof settings.site_name === "string" && settings.site_name
      ? settings.site_name
      : "Serna Educational Services";
  const logoUrl =
    typeof settings.logo_url === "string" ? settings.logo_url || undefined : undefined;
  const markLetter =
    typeof settings.logo_mark_letter === "string" && settings.logo_mark_letter
      ? settings.logo_mark_letter
      : brandName.slice(0, 1).toUpperCase();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <Link
          href="/"
          aria-label={`${brandName} home`}
          className="mb-7 inline-flex items-center justify-center gap-2.5 no-underline"
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={brandName}
              height={logoHeight}
              style={{ height: logoHeight }}
              className="w-auto max-w-[260px] object-contain"
            />
          ) : (
            <>
              <span
                aria-hidden
                className="grid h-10 w-10 place-items-center rounded-[11px] bg-gradient-to-br from-violet to-indigo font-display text-lg font-extrabold text-white"
              >
                {markLetter}
              </span>
              <span className="font-display text-lg font-bold text-ink">{brandName}</span>
            </>
          )}
        </Link>
        <div className="flex w-full justify-center">{children}</div>
      </main>
    </div>
  );
}
