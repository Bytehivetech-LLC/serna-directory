import type { Metadata } from "next";
import "./globals.css";
import { fontBricolage, fontInter } from "@/lib/fonts";
import { getTheme } from "@/lib/theme/get-theme";
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
  const theme = await getTheme();
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
