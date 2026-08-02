import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { getSession } from "@/lib/auth/guards";

export default async function WebLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader authed={Boolean(session?.user)} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
