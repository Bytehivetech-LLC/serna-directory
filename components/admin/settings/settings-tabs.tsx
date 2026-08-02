"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { MenuItem } from "@/types";
import type { Theme } from "@/lib/theme/defaults";
import type { ThemePreset } from "@/lib/theme/presets";
import type { IntegrationPanel } from "@/lib/admin/integrations-queries";
import type { StripeStatus } from "@/lib/stripe/status";
import type { ScriptRow } from "@/lib/admin/scripts-queries";
import { IntegrationsTab } from "./integrations-tab";
import { ScriptsTab } from "./scripts-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionCard } from "@/components/layout/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ThemeEditor } from "./theme-editor";
import {
  updateBrandingAction,
  signBrandingUploadAction,
  setBrandingImageAction,
  updateDirectoryAction,
  updateMapsAction,
  updateEmailAction,
  sendTestEmailAction,
  createMenuItemAction,
  toggleMenuItemAction,
  reorderMenuItemsAction,
  deleteMenuItemAction,
} from "@/lib/admin/settings-actions";

type SettingsMap = Record<string, unknown>;
const str = (m: SettingsMap, k: string, d = "") => (typeof m[k] === "string" ? (m[k] as string) : d);
const num = (m: SettingsMap, k: string, d: number) => (typeof m[k] === "number" ? (m[k] as number) : d);
const bool = (m: SettingsMap, k: string, d: boolean) => (typeof m[k] === "boolean" ? (m[k] as boolean) : d);

export function SettingsTabs({
  settings,
  menuItems,
  theme,
  integrations,
  scripts,
}: {
  settings: SettingsMap;
  menuItems: MenuItem[];
  theme: { draft: Theme; published: Theme; presets: ThemePreset[]; hasDraft: boolean };
  integrations: { integrations: IntegrationPanel[]; stripe: StripeStatus };
  scripts: ScriptRow[];
}) {
  return (
    <Tabs defaultValue="branding" className="w-full">
      <TabsList className="flex-wrap">
        <TabsTrigger value="branding">Branding</TabsTrigger>
        <TabsTrigger value="theme">Theme</TabsTrigger>
        <TabsTrigger value="navigation">Navigation</TabsTrigger>
        <TabsTrigger value="directory">Directory</TabsTrigger>
        <TabsTrigger value="maps">Maps</TabsTrigger>
        <TabsTrigger value="email">Email</TabsTrigger>
        <TabsTrigger value="integrations">Integrations</TabsTrigger>
        <TabsTrigger value="scripts">Scripts</TabsTrigger>
      </TabsList>

      <TabsContent value="branding" className="mt-6"><BrandingTab settings={settings} /></TabsContent>
      <TabsContent value="theme" className="mt-6">
        <ThemeEditor draft={theme.draft} published={theme.published} presets={theme.presets} hasDraft={theme.hasDraft} />
      </TabsContent>
      <TabsContent value="navigation" className="mt-6"><NavigationTab items={menuItems} /></TabsContent>
      <TabsContent value="directory" className="mt-6"><DirectoryTab settings={settings} /></TabsContent>
      <TabsContent value="maps" className="mt-6"><MapsTab settings={settings} /></TabsContent>
      <TabsContent value="email" className="mt-6"><EmailTab settings={settings} /></TabsContent>
      <TabsContent value="integrations" className="mt-6">
        <IntegrationsTab integrations={integrations.integrations} stripe={integrations.stripe} />
      </TabsContent>
      <TabsContent value="scripts" className="mt-6">
        <ScriptsTab scripts={scripts} bannerEnabled={settings.consent_banner_enabled === true} />
      </TabsContent>
    </Tabs>
  );
}

function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.ok) { if (res.message) toast.success(res.message); after?.(); router.refresh(); }
      else toast.error(res.error);
    });
  return { pending, run };
}

/* --------------------------------------------------------------- branding --- */

function BrandingTab({ settings }: { settings: SettingsMap }) {
  const { pending, run } = useAct();
  const [f, setF] = useState({
    site_name: str(settings, "site_name", "Serna Educational Services"),
    logo_mark_letter: str(settings, "logo_mark_letter", "S"),
    hero_heading: str(settings, "hero_heading"),
    hero_subheading: str(settings, "hero_subheading"),
    footer_text: str(settings, "footer_text"),
  });
  const [logoUrl, setLogoUrl] = useState(str(settings, "logo_url"));
  const [faviconUrl, setFaviconUrl] = useState(str(settings, "favicon_url"));
  const set = <K extends keyof typeof f>(k: K, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function upload(kind: "logo" | "favicon", file: File) {
    const ext = file.name.split(".").pop() ?? "png";
    const signed = await signBrandingUploadAction(kind, ext);
    if (!signed.ok) return toast.error(signed.error);
    const supabase = createClient();
    const { error } = await supabase.storage.from("site-assets").uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
    if (error) return toast.error("Upload failed.");
    run(async () => {
      const res = await setBrandingImageAction(kind, signed.path);
      if (res.ok) {
        const url = supabase.storage.from("site-assets").getPublicUrl(signed.path).data.publicUrl;
        if (kind === "logo") setLogoUrl(url);
        else setFaviconUrl(url);
      }
      return res;
    });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <SectionCard title="Brand">
        <div className="space-y-4">
          <Field label="Site name"><Input value={f.site_name} onChange={(e) => set("site_name", e.target.value)} /></Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Logo mark letter"><Input maxLength={2} value={f.logo_mark_letter} onChange={(e) => set("logo_mark_letter", e.target.value)} /></Field>
            <Field label="Logo image">
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="" className="h-9 rounded border border-border bg-secondary object-contain px-2" />
                ) : null}
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-secondary">
                  <Upload className="h-4 w-4" /> Upload
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload("logo", file); }} />
                </label>
              </div>
            </Field>
          </div>
          <Field label="Favicon">
            <div className="flex items-center gap-3">
              {faviconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={faviconUrl} alt="Current favicon" className="h-8 w-8 rounded border border-border bg-secondary object-contain p-1" />
              ) : null}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-secondary">
                <Upload className="h-4 w-4" /> Upload favicon
                <input type="file" accept="image/png,image/x-icon,image/svg+xml" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload("favicon", file); }} />
              </label>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              PNG, ICO, or SVG. Browsers cache favicons hard — after saving you may
              need a hard refresh (Ctrl/Cmd+Shift+R) to see the new one in your tab.
            </p>
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Homepage & footer">
        <div className="space-y-4">
          <Field label="Hero heading"><Input value={f.hero_heading} onChange={(e) => set("hero_heading", e.target.value)} /></Field>
          <Field label="Hero subheading"><Textarea rows={2} value={f.hero_subheading} onChange={(e) => set("hero_subheading", e.target.value)} /></Field>
          <Field label="Footer text"><Textarea rows={2} value={f.footer_text} onChange={(e) => set("footer_text", e.target.value)} /></Field>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button disabled={pending} onClick={() => run(() => updateBrandingAction(f))}>Save branding</Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- directory --- */

function DirectoryTab({ settings }: { settings: SettingsMap }) {
  const { pending, run } = useAct();
  const [f, setF] = useState({
    listings_per_page: num(settings, "listings_per_page", 12),
    default_sort: str(settings, "default_sort", "relevance"),
    review_sla_days: num(settings, "review_sla_days", 2),
    allow_pending_direct_link: bool(settings, "allow_pending_direct_link", true),
  });

  return (
    <div className="max-w-2xl space-y-4">
      <SectionCard title="Directory">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Listings per page"><Input type="number" min={6} max={60} value={f.listings_per_page} onChange={(e) => setF((p) => ({ ...p, listings_per_page: Number(e.target.value) }))} /></Field>
            <Field label="Default sort">
              <select value={f.default_sort} onChange={(e) => setF((p) => ({ ...p, default_sort: e.target.value }))} className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-ink">
                <option value="relevance">Relevance</option>
                <option value="newest">Newest</option>
                <option value="name">Name</option>
                <option value="featured">Featured first</option>
              </select>
            </Field>
          </div>
          <Field label="Review turnaround shown to applicants (days)"><Input type="number" min={0} max={30} value={f.review_sla_days} onChange={(e) => setF((p) => ({ ...p, review_sla_days: Number(e.target.value) }))} /></Field>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">Pending listings reachable by direct link</span>
            <Switch checked={f.allow_pending_direct_link} onCheckedChange={(v) => setF((p) => ({ ...p, allow_pending_direct_link: v }))} aria-label="Allow pending direct link" />
          </div>
        </div>
      </SectionCard>
      <div className="flex justify-end"><Button disabled={pending} onClick={() => run(() => updateDirectoryAction(f))}>Save</Button></div>
    </div>
  );
}

/* ------------------------------------------------------------------ maps --- */

function MapsTab({ settings }: { settings: SettingsMap }) {
  const { pending, run } = useAct();
  const center = (settings.default_map_center ?? {}) as { lat?: number; lng?: number; zoom?: number };
  const [f, setF] = useState({
    lat: center.lat ?? 33.4484,
    lng: center.lng ?? -112.074,
    zoom: center.zoom ?? 10,
    google_maps_browser_key: str(settings, "google_maps_browser_key"),
  });

  return (
    <div className="max-w-2xl space-y-4">
      <SectionCard title="Map defaults">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Latitude"><Input type="number" step="0.0001" value={f.lat} onChange={(e) => setF((p) => ({ ...p, lat: Number(e.target.value) }))} /></Field>
            <Field label="Longitude"><Input type="number" step="0.0001" value={f.lng} onChange={(e) => setF((p) => ({ ...p, lng: Number(e.target.value) }))} /></Field>
            <Field label="Zoom"><Input type="number" min={1} max={20} value={f.zoom} onChange={(e) => setF((p) => ({ ...p, zoom: Number(e.target.value) }))} /></Field>
          </div>
          <Field label="Browser Maps API key"><Input value={f.google_maps_browser_key} onChange={(e) => setF((p) => ({ ...p, google_maps_browser_key: e.target.value }))} placeholder="AIza…" /></Field>
        </div>
      </SectionCard>
      <div className="flex justify-end"><Button disabled={pending} onClick={() => run(() => updateMapsAction(f))}>Save</Button></div>
    </div>
  );
}

/* ----------------------------------------------------------------- email --- */

function EmailTab({ settings }: { settings: SettingsMap }) {
  const { pending, run } = useAct();
  const recipients = Array.isArray(settings.admin_notification_recipients)
    ? (settings.admin_notification_recipients as string[]).join(", ")
    : "";
  const [f, setF] = useState({
    email_from_name: str(settings, "email_from_name", "Serna Educational Services"),
    email_from_address: str(settings, "email_from_address"),
    admin_notification_recipients: recipients,
  });

  return (
    <div className="max-w-2xl space-y-4">
      <SectionCard title="Email">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="From name"><Input value={f.email_from_name} onChange={(e) => setF((p) => ({ ...p, email_from_name: e.target.value }))} /></Field>
            <Field label="From address"><Input type="email" value={f.email_from_address} onChange={(e) => setF((p) => ({ ...p, email_from_address: e.target.value }))} /></Field>
          </div>
          <Field label="Admin notification recipients (comma or line separated)"><Textarea rows={2} value={f.admin_notification_recipients} onChange={(e) => setF((p) => ({ ...p, admin_notification_recipients: e.target.value }))} /></Field>
          <p className="text-xs text-muted-foreground">The from address must be a SendGrid-verified sender.</p>
        </div>
      </SectionCard>
      <div className="flex justify-between">
        <Button variant="outline" disabled={pending} onClick={() => run(() => sendTestEmailAction())}>Send test email</Button>
        <Button disabled={pending} onClick={() => run(() => updateEmailAction(f))}>Save</Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ navigation --- */

function NavigationTab({ items }: { items: MenuItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <MenuColumn location="header" title="Header menu" items={items.filter((i) => i.location === "header")} />
      <MenuColumn location="footer" title="Footer menu" items={items.filter((i) => i.location === "footer")} />
    </div>
  );
}

function MenuColumn({ location, title, items }: { location: "header" | "footer"; title: string; items: MenuItem[] }) {
  const { pending, run } = useAct();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [newTab, setNewTab] = useState(false);
  const [parent, setParent] = useState("");
  const tops = items.filter((i) => !i.parent_id).sort((a, b) => a.sort_order - b.sort_order);

  function move(i: number, dir: -1 | 1) {
    const t = i + dir;
    if (t < 0 || t >= tops.length) return;
    const next = [...tops];
    [next[i], next[t]] = [next[t], next[i]];
    run(() => reorderMenuItemsAction(next.map((x) => x.id)));
  }

  return (
    <SectionCard title={title}>
      <ul className="divide-y divide-border">
        {tops.map((item, i) => (
          <li key={item.id}>
            <div className="flex items-center justify-between gap-2 py-2">
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button aria-label="Up" disabled={i === 0 || pending} onClick={() => move(i, -1)} className="text-faint hover:text-ink disabled:opacity-30"><ArrowUp className="h-3 w-3" /></button>
                  <button aria-label="Down" disabled={i === tops.length - 1 || pending} onClick={() => move(i, 1)} className="text-faint hover:text-ink disabled:opacity-30"><ArrowDown className="h-3 w-3" /></button>
                </div>
                <div>
                  <div className="text-sm font-semibold text-ink">{item.label}{item.opens_new_tab ? " ↗" : ""}</div>
                  <div className="text-xs text-faint">{item.url}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={item.is_active} onCheckedChange={(v) => run(() => toggleMenuItemAction(item.id, v))} aria-label="Active" />
                <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => run(() => deleteMenuItemAction(item.id))}><X className="h-4 w-4" /></Button>
              </div>
            </div>
            {items.filter((c) => c.parent_id === item.id).map((child) => (
              <div key={child.id} className="flex items-center justify-between gap-2 border-t border-border/60 py-2 pl-8">
                <div>
                  <div className="text-sm text-ink">{child.label}{child.opens_new_tab ? " ↗" : ""}</div>
                  <div className="text-xs text-faint">{child.url}</div>
                </div>
                <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => run(() => deleteMenuItemAction(child.id))}><X className="h-4 w-4" /></Button>
              </div>
            ))}
          </li>
        ))}
        {tops.length === 0 ? <li className="py-3 text-sm text-muted-foreground">No links yet.</li> : null}
      </ul>

      <div className="mt-4 space-y-2 border-t border-border pt-4">
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Input placeholder="/path or https://" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-ink"><Switch checked={newTab} onCheckedChange={setNewTab} aria-label="New tab" /> New tab</label>
          <select value={parent} onChange={(e) => setParent(e.target.value)} className="h-9 flex-1 rounded-lg border border-border bg-card px-2 text-sm text-ink">
            <option value="">Top level</option>
            {tops.map((t) => <option key={t.id} value={t.id}>Under “{t.label}”</option>)}
          </select>
          <Button
            size="sm"
            disabled={pending || !label.trim() || !url.trim()}
            onClick={() => run(
              async () => {
                const res = await createMenuItemAction({ location, label, url, opens_new_tab: newTab, parent_id: parent || null });
                if (res.ok) { setLabel(""); setUrl(""); setParent(""); setNewTab(false); }
                return res;
              },
            )}
          >
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
