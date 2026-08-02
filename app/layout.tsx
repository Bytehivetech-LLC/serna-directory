import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { fontBricolage, fontInter } from "@/lib/fonts";
import { getTheme, getDraftTheme } from "@/lib/theme/get-theme";
import { getUserRole } from "@/lib/auth/guards";
import { toCssVars } from "@/lib/theme/to-css-vars";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: {
    default: "Serna Educational Services Directory",
    template: "%s · Serna Educational Services",
  },
  description:
    "Find Arizona homeschool tutors, co-ops, micro-schools, and enrichment programs — and list your own business for families to discover.",
};

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
