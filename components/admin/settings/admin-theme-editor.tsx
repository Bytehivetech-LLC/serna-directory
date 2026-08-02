"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { toAdminCssVars } from "@/lib/theme/to-css-vars";
import { contrastRatio } from "@/lib/theme/contrast";
import {
  ADMIN_EXTRA_KEYS,
  defaultAdminTheme,
  type AdminTheme,
} from "@/lib/theme/admin-defaults";
import { THEME_COLOR_KEYS } from "@/lib/theme/defaults";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUploadField, type UploadResult } from "@/components/ui/image-upload-field";
import { createClient } from "@/lib/supabase/client";
import {
  publishAdminThemeAction,
  resetAdminThemeAction,
  copyPublicToAdminThemeAction,
  signAdminLogoUploadAction,
  setAdminLogoAction,
} from "@/lib/admin/admin-theme-actions";

type Key = keyof AdminTheme;

const LABELS: Partial<Record<Key, string>> = {
  ink: "Ink", muted: "Muted", faint: "Faint", card: "Card", bg: "Page background",
  border: "Border", violet: "Violet", indigo: "Indigo",
  sidebarBg: "Sidebar background", sidebarText: "Sidebar text",
  sidebarActiveBg: "Active item background", sidebarActiveText: "Active item text",
  sidebarBorder: "Sidebar border", brandBarBg: "Brand bar background",
  brandBarText: "Brand bar text",
};

const SIDEBAR_KEYS: Key[] = [...ADMIN_EXTRA_KEYS];
const CONTENT_KEYS: Key[] = ["bg", "card", "ink", "muted", "faint", "border", "violet", "indigo"];

const CONTRAST_PAIRS: { label: string; fg: Key; bg: Key; min: number }[] = [
  { label: "Sidebar text on sidebar", fg: "sidebarText", bg: "sidebarBg", min: 4.5 },
  { label: "Active text on active", fg: "sidebarActiveText", bg: "sidebarActiveBg", min: 4.5 },
  { label: "Brand-bar text on brand bar", fg: "brandBarText", bg: "brandBarBg", min: 4.5 },
  { label: "Ink on card", fg: "ink", bg: "card", min: 4.5 },
];

export function AdminThemeEditor({
  adminTheme,
  adminLogoUrl,
}: {
  adminTheme: AdminTheme;
  adminLogoUrl: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [theme, setTheme] = useState<AdminTheme>(adminTheme);

  const previewCss = useMemo(
    () => toAdminCssVars(theme, ".admin-theme-preview"),
    [theme],
  );
  const contrast = useMemo(
    () =>
      CONTRAST_PAIRS.map((p) => {
        const ratio = Math.round(contrastRatio(theme[p.fg], theme[p.bg]) * 100) / 100;
        return { label: p.label, ratio, min: p.min, pass: ratio >= p.min };
      }),
    [theme],
  );
  const blocked = contrast.some((c) => !c.pass);

  const setColor = (k: Key, v: string) => setTheme((t) => ({ ...t, [k]: v }));

  function act(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? "Saved.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    });
  }

  async function uploadLogo(file: File): Promise<UploadResult> {
    const ext = file.name.split(".").pop() ?? "png";
    const signed = await signAdminLogoUploadAction(ext);
    if (!signed.ok) return { ok: false, error: signed.error };
    const supabase = createClient();
    const up = await supabase.storage
      .from("site-assets")
      .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
    if (up.error) return { ok: false, error: "Upload failed. Please try again." };
    const res = await setAdminLogoAction(signed.path);
    if (!res.ok) return { ok: false, error: res.error };
    router.refresh();
    return { ok: true, url: supabase.storage.from("site-assets").getPublicUrl(signed.path).data.publicUrl };
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Controls */}
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-violet">Sidebar & brand bar</h3>
          <div className="space-y-2">
            {SIDEBAR_KEYS.map((k) => (
              <ColorRow key={k} label={LABELS[k] ?? k} value={theme[k]} onChange={(v) => setColor(k, v)} onReset={() => setColor(k, defaultAdminTheme[k])} />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-violet">Content surfaces</h3>
          <div className="space-y-2">
            {CONTENT_KEYS.map((k) => (
              <ColorRow key={k} label={LABELS[k] ?? k} value={theme[k]} onChange={(v) => setColor(k, v)} onReset={() => setColor(k, defaultAdminTheme[k])} />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <ImageUploadField
            label="Admin logo (brand bar)"
            value={adminLogoUrl}
            accept={["image/png", "image/jpeg", "image/webp", "image/svg+xml"]}
            onUpload={uploadLogo}
            hint="Shown in the sidebar brand bar. Falls back to the public logo, then the letter mark."
          />
        </div>
      </div>

      {/* Preview + contrast + actions */}
      <div className="space-y-4 lg:sticky lg:top-6 lg:h-fit">
        <style dangerouslySetInnerHTML={{ __html: previewCss }} />
        <MiniAdminShell logoUrl={adminLogoUrl} />

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 text-sm font-bold text-ink">Contrast (WCAG AA)</h3>
          <ul className="space-y-1.5 text-sm">
            {contrast.map((c) => (
              <li key={c.label} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  {c.pass ? <Check className="h-4 w-4 text-good" /> : <X className="h-4 w-4 text-danger" />}
                  {c.label}
                </span>
                <span className={`font-mono text-xs ${c.pass ? "text-faint" : "text-danger"}`}>
                  {c.ratio}:1
                </span>
              </li>
            ))}
          </ul>
          {blocked ? (
            <p className="mt-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-ink">
              Fix the failing pairs before publishing.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button disabled={pending || blocked} onClick={() => act(() => publishAdminThemeAction(theme))}>
            Publish admin theme
          </Button>
          <Button variant="outline" disabled={pending} onClick={() => act(() => copyPublicToAdminThemeAction())}>
            Copy from public theme
          </Button>
          <Button variant="ghost" disabled={pending} onClick={() => act(() => resetAdminThemeAction())}>
            <RotateCcw className="h-4 w-4" /> Reset to default
          </Button>
        </div>
      </div>
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
  onReset,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="h-8 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent"
      />
      <Label className="flex-1 text-sm">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="w-28 font-mono text-xs" />
      <button type="button" onClick={onReset} aria-label={`Reset ${label}`} className="text-faint hover:text-violet">
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** A miniature of the real admin shell so edits are legible in place. */
function MiniAdminShell({ logoUrl }: { logoUrl: string | null }) {
  return (
    <div className="admin-theme-preview overflow-hidden rounded-xl border border-border">
      <div className="flex h-56">
        <div className="flex w-32 flex-col bg-sidebar-bg text-sidebar-text">
          <div className="flex items-center justify-between gap-1 bg-brand-bar-bg px-2 py-2 text-brand-bar-text">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-4 w-auto max-w-[70px] object-contain" />
            ) : (
              <span className="text-[11px] font-bold">Serna</span>
            )}
            <span className="rounded bg-violet px-1 py-0.5 text-[8px] font-bold uppercase text-white">Admin</span>
          </div>
          <div className="space-y-1 p-2">
            <div className="rounded bg-sidebar-active-bg px-2 py-1 text-[10px] font-semibold text-sidebar-active-text">Dashboard</div>
            <div className="px-2 py-1 text-[10px] text-sidebar-text/70">Listings</div>
            <div className="px-2 py-1 text-[10px] text-sidebar-text/70">Users</div>
          </div>
        </div>
        <div className="flex-1 bg-bg p-3">
          <div className="mb-2 h-2 w-20 rounded bg-ink/80" />
          <div className="rounded-lg border border-border bg-card p-2">
            <div className="mb-1 h-1.5 w-16 rounded bg-muted/70" />
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-good-soft px-1.5 py-0.5 text-[9px] font-semibold text-good">Live</span>
              <span className="rounded-md bg-violet px-2 py-0.5 text-[9px] font-semibold text-white">Button</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
