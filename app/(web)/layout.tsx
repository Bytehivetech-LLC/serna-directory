import { SiteHeader, type NavItem } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ScriptInjector } from "@/components/layout/script-injector";
import { ConsentBanner } from "@/components/consent/consent-banner";
import { getSession } from "@/lib/auth/guards";
import { getSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

export default async function WebLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [session, settings, supabase] = await Promise.all([
    getSession(),
    getSettings(["site_name", "logo_url", "logo_mark_letter", "footer_text", "consent_banner_enabled"]),
    createClient(),
  ]);

  const { data: menu } = await supabase
    .from("menu_items")
    .select("label, url, location")
    .eq("is_active", true)
    .is("parent_id", null)
    .order("sort_order", { ascending: true });

  const headerNav: NavItem[] = (menu ?? [])
    .filter((m) => m.location === "header")
    .map((m) => ({ label: m.label, href: m.url }));
  const footerNav = (menu ?? [])
    .filter((m) => m.location === "footer")
    .map((m) => ({ label: m.label, href: m.url }));

  const brandName =
    typeof settings.site_name === "string" && settings.site_name
      ? settings.site_name
      : "Serna Educational Services";
  const logoUrl =
    typeof settings.logo_url === "string" ? settings.logo_url || undefined : undefined;
  const markLetter =
    typeof settings.logo_mark_letter === "string" && settings.logo_mark_letter
      ? settings.logo_mark_letter
      : "S";
  const footerText =
    typeof settings.footer_text === "string" ? settings.footer_text : undefined;

  const consentEnabled = settings.consent_banner_enabled === true;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Admin-configured tracking — PUBLIC layout only (self-guards on APP_TARGET). */}
      <ScriptInjector slot="head" />
      <ScriptInjector slot="body_start" />
      <SiteHeader
        authed={Boolean(session?.user)}
        brandName={brandName}
        logoUrl={logoUrl}
        markLetter={markLetter}
        nav={headerNav.length ? headerNav : undefined}
      />
      <main className="flex-1">{children}</main>
      <SiteFooter
        brandName={brandName}
        markLetter={markLetter}
        footerText={footerText}
        nav={footerNav.length ? footerNav : undefined}
      />
      <ScriptInjector slot="body_end" />
      <ConsentBanner enabled={consentEnabled} />
    </div>
  );
}
