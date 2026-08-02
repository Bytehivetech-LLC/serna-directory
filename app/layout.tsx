import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { fontBricolage, fontInter } from "@/lib/fonts";
import { getTheme, getDraftTheme } from "@/lib/theme/get-theme";
import { getUserRole } from "@/lib/auth/guards";
import { toCssVars } from "@/lib/theme/to-css-vars";
import { getSettingWithMeta } from "@/lib/settings";
import { Toaster } from "@/components/ui/sonner";

export async function generateMetadata(): Promise<Metadata> {
  // Serve the admin-uploaded favicon through Next metadata (not just storage).
  // Favicons cache hard, so bust with ?v=<updated_at> — the usual reason a new
  // one "doesn't take". Falls back to the static /favicon.ico.
  const { value, updatedAt } = await getSettingWithMeta("favicon_url");
  const faviconUrl = typeof value === "string" && value.trim() ? value.trim() : null;

  let icons: Metadata["icons"];
  if (faviconUrl) {
    const v = encodeURIComponent(updatedAt ?? "1");
    const bust = `${faviconUrl}${faviconUrl.includes("?") ? "&" : "?"}v=${v}`;
    const type = faviconUrl.endsWith(".svg")
      ? "image/svg+xml"
      : faviconUrl.endsWith(".png")
        ? "image/png"
        : faviconUrl.endsWith(".ico")
          ? "image/x-icon"
          : undefined;
    icons = {
      icon: [{ url: bust, ...(type ? { type } : {}) }],
      apple: [{ url: bust }],
    };
  } else {
    icons = { icon: "/favicon.ico" };
  }

  return {
    title: {
      default: "Serna Educational Services Directory",
      template: "%s · Serna Educational Services",
    },
    description:
      "Find Arizona homeschool tutors, co-ops, micro-schools, and enrichment programs — and list your own business for families to discover.",
    icons,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Admins previewing the draft theme (?theme=draft sets the cookie) see the
  // draft; everyone else always sees the published theme.
  const wantDraft =
    (await cookies()).get("serna-theme-preview")?.value === "draft";
  const theme =
    wantDraft && (await getUserRole()) === "admin"
      ? await getDraftTheme()
      : await getTheme();
  const themeCss = toCssVars(theme);

  return (
    <html
      lang="en"
      className={`${fontBricolage.variable} ${fontInter.variable}`}
    >
      <body>
        {/* Runtime theme, injected before any content so nothing renders unstyled. */}
        <style
          id="theme-vars"
          dangerouslySetInnerHTML={{ __html: themeCss }}
        />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
