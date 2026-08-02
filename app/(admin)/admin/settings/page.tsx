import type { Metadata } from "next";
import { getAllSettings, getMenuItems } from "@/lib/admin/settings-queries";
import { getThemeEditorData, getAdminThemeEditorData } from "@/lib/admin/theme-queries";
import { getIntegrationsPanel } from "@/lib/admin/integrations-queries";
import { getScripts } from "@/lib/admin/scripts-queries";
import { getSiteUrlResolution, getAdminUrlResolution } from "@/lib/site-url";
import { PageHeading } from "@/components/layout/page-heading";
import { SettingsTabs } from "@/components/admin/settings/settings-tabs";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [settings, menuItems, theme, adminTheme, integrations, scripts, siteRes, adminRes] =
    await Promise.all([
      getAllSettings(),
      getMenuItems(),
      getThemeEditorData(),
      getAdminThemeEditorData(),
      getIntegrationsPanel(),
      getScripts(),
      getSiteUrlResolution(),
      getAdminUrlResolution(),
    ]);
  const isProd = process.env.NODE_ENV === "production";

  return (
    <div className="space-y-6">
      <PageHeading title="Settings" lede="Branding, theme, navigation, and site configuration." />
      <SettingsTabs
        settings={settings}
        menuItems={menuItems}
        theme={theme}
        adminTheme={adminTheme}
        integrations={integrations}
        scripts={scripts}
        urls={{ site: siteRes, admin: adminRes, isProd }}
      />
    </div>
  );
}
