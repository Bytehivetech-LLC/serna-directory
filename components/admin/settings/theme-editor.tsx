"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pipette, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { defaultTheme, THEME_COLOR_KEYS, type Theme } from "@/lib/theme/defaults";
import { toCssVarsScoped } from "@/lib/theme/to-css-vars";
import { evaluateContrast } from "@/lib/theme/contrast";
import { ALLOWED_FONTS } from "@/lib/theme/fonts-list";
import type { ThemePreset } from "@/lib/theme/presets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  saveThemeDraftAction,
  publishThemeAction,
  discardDraftAction,
  resetDraftToDefaultAction,
  savePresetAction,
  applyPresetAction,
  deletePresetAction,
} from "@/lib/admin/theme-actions";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "";

type ColorKey = (typeof THEME_COLOR_KEYS)[number];
const LABELS: Record<ColorKey, string> = {
  ink: "Ink", muted: "Muted", faint: "Faint",
  indigo: "Indigo", indigoDeep: "Indigo deep", violet: "Violet", violetSoft: "Violet soft",
  bg: "Page background", card: "Card", border: "Border", borderStrong: "Border strong",
  good: "Good", goodSoft: "Good soft", warm: "Warm", warmBorder: "Warm border",
  danger: "Danger", dangerSoft: "Danger soft", headerBg: "Header background", headerText: "Header text",
};

const GROUPS: { title: string; keys: ColorKey[] }[] = [
  { title: "Text", keys: ["ink", "muted", "faint"] },
  { title: "Brand", keys: ["indigo", "indigoDeep", "violet", "violetSoft"] },
  { title: "Surfaces", keys: ["bg", "card", "headerBg", "headerText"] },
  { title: "Borders", keys: ["border", "borderStrong"] },
  { title: "States", keys: ["good", "goodSoft", "warm", "warmBorder", "danger", "dangerSoft"] },
];

export function ThemeEditor({
  draft,
  presets,
  hasDraft,
}: {
  draft: Theme;
  published: Theme;
  presets: ThemePreset[];
  hasDraft: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [theme, setTheme] = useState<Theme>(draft);
  const [confirm, setConfirm] = useState<null | "discard" | "reset">(null);
  const [presetName, setPresetName] = useState("");
  const firstRender = useRef(true);

  // Debounced draft autosave so "Preview on live site" reflects the latest edit.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const id = setTimeout(() => {
      void saveThemeDraftAction(theme);
    }, 700);
    return () => clearTimeout(id);
  }, [theme]);

  const previewCss = useMemo(() => toCssVarsScoped(theme, ".theme-preview"), [theme]);
  const contrast = useMemo(() => evaluateContrast(theme), [theme]);
  const blocked = contrast.some((c) => c.blocking && !c.pass);

  const setColor = (key: ColorKey, value: string) =>
    setTheme((t) => ({ ...t, [key]: value }));
  const radiusNum = parseInt(theme.radius, 10) || 0;

  async function eyedrop(key: ColorKey) {
    const w = window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } };
    if (!w.EyeDropper) {
      toast.message("Your browser doesn't support the eyedropper.");
      return;
    }
    try {
      const res = await new w.EyeDropper().open();
      setColor(key, res.sRGBHex);
    } catch {
      /* cancelled */
    }
  }

  function act(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        if (res.message) toast.success(res.message);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function publish() {
    startTransition(async () => {
      const res = await publishThemeAction(theme);
      if (res.ok) {
        toast.success(res.message ?? "Published.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function previewLive() {
    // Ensure the draft is saved, then open the public site in draft mode.
    startTransition(async () => {
      await saveThemeDraftAction(theme);
      window.open(`${SITE_URL}/?theme=draft`, "_blank", "noopener");
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Controls */}
      <div className="space-y-6">
        {GROUPS.map((group) => (
          <div key={group.title} className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-violet">{group.title}</h3>
            <div className="space-y-2">
              {group.keys.map((key) => (
                <ColorRow
                  key={key}
                  label={LABELS[key]}
                  value={theme[key]}
                  onChange={(v) => setColor(key, v)}
                  onReset={() => setColor(key, defaultTheme[key])}
                  onEyedrop={() => eyedrop(key)}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-violet">Shape</h3>
          <Label className="text-sm">Corner radius — {radiusNum}px</Label>
          <input
            type="range"
            min={0}
            max={24}
            value={radiusNum}
            onChange={(e) => setTheme((t) => ({ ...t, radius: `${e.target.value}px` }))}
            className="mt-2 w-full accent-violet"
            aria-label="Corner radius"
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-violet">Type</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FontSelect label="Display font" value={theme.fontDisplay} onChange={(v) => setTheme((t) => ({ ...t, fontDisplay: v }))} />
            <FontSelect label="Body font" value={theme.fontBody} onChange={(v) => setTheme((t) => ({ ...t, fontBody: v }))} />
          </div>
        </div>
      </div>

      {/* Preview + contrast + actions */}
      <div className="space-y-4 lg:sticky lg:top-6 lg:h-fit">
        <style dangerouslySetInnerHTML={{ __html: previewCss }} />
        <ThemePreviewPane />

        {/* Contrast guard */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 text-sm font-bold text-ink">Contrast (WCAG AA)</h3>
          <ul className="space-y-1.5 text-sm">
            {contrast.map((c) => (
              <li key={c.label} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  {c.pass ? (
                    <Check className="h-4 w-4 text-good" />
                  ) : (
                    <X className={`h-4 w-4 ${c.blocking ? "text-danger" : "text-[#b4791e]"}`} />
                  )}
                  <span className={c.pass ? "text-muted-foreground" : "text-ink"}>{c.label}</span>
                </span>
                <span className={`font-mono text-xs ${c.pass ? "text-faint" : c.blocking ? "text-danger" : "text-[#b4791e]"}`}>
                  {c.ratio.toFixed(2)} / {c.min}
                </span>
              </li>
            ))}
          </ul>
          {blocked ? (
            <p className="mt-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-ink">
              Publish is blocked until every red pair meets its ratio.
            </p>
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={publish} disabled={pending || blocked}>Publish theme</Button>
          <Button variant="outline" onClick={previewLive} disabled={pending}>Preview on live site</Button>
          <Button variant="ghost" onClick={() => setConfirm("discard")} disabled={pending || !hasDraft}>Discard draft</Button>
          <Button variant="ghost" onClick={() => setConfirm("reset")} disabled={pending}>Reset to default</Button>
        </div>

        {/* Presets */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-bold text-ink">Presets</h3>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-sm">
                <button className="font-semibold text-ink hover:text-indigo" onClick={() => act(() => applyPresetAction(p.id))}>
                  {p.name}
                </button>
                {!p.builtIn ? (
                  <button aria-label={`Delete ${p.name}`} className="text-faint hover:text-danger" onClick={() => act(() => deletePresetAction(p.id))}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </span>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Save current as…" className="h-9" />
            <Button
              variant="outline"
              size="sm"
              disabled={pending || !presetName.trim()}
              onClick={() => act(async () => {
                const res = await savePresetAction(presetName, theme);
                if (res.ok) setPresetName("");
                return res;
              })}
            >
              Save preset
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {confirm === "discard" ? "Discard the draft?" : "Reset to the Serna default?"}
            </DialogTitle>
            <DialogDescription>
              {confirm === "discard"
                ? "Your unsaved palette goes back to what's currently published."
                : "The working palette becomes the original Serna theme. You can still publish or discard afterward."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              onClick={() => {
                const c = confirm;
                setConfirm(null);
                if (c === "discard") act(async () => { const r = await discardDraftAction(); if (r.ok) router.refresh(); return r; });
                else act(async () => { const r = await resetDraftToDefaultAction(); if (r.ok) setTheme(defaultTheme); return r; });
              }}
            >
              {confirm === "discard" ? "Discard" : "Reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
  onReset,
  onEyedrop,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onReset: () => void;
  onEyedrop: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border" style={{ backgroundColor: value }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={`${label} colour`} />
      </label>
      <span className="w-28 shrink-0 text-sm text-ink">{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 flex-1 font-mono text-xs uppercase" />
      <button type="button" aria-label={`Pick ${label} with eyedropper`} onClick={onEyedrop} className="text-faint hover:text-indigo">
        <Pipette className="h-4 w-4" />
      </button>
      <button type="button" aria-label={`Reset ${label}`} onClick={onReset} className="text-faint hover:text-indigo">
        <RotateCcw className="h-4 w-4" />
      </button>
    </div>
  );
}

function FontSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet">
        {ALLOWED_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>
    </div>
  );
}

/** The live preview — normal Tailwind utilities, repainted by the scoped vars. */
function ThemePreviewPane() {
  return (
    <div className="theme-preview space-y-4 rounded-2xl border border-border bg-bg p-4" style={{ fontFamily: "var(--font-body)" }}>
      {/* Header miniature */}
      <div className="flex items-center justify-between rounded-lg bg-header-bg px-3 py-2" style={{ borderRadius: "var(--radius-card)" }}>
        <span className="font-display text-sm font-bold text-header-text" style={{ fontFamily: "var(--font-display)" }}>Serna</span>
        <span className="text-xs text-header-text/70">Directory</span>
      </div>

      {/* Directory tile */}
      <div className="overflow-hidden border border-border bg-card shadow-card" style={{ borderRadius: "var(--radius-card)" }}>
        <div className="h-20 bg-gradient-to-br from-violet to-indigo" />
        <div className="space-y-1 p-3">
          <div className="font-display text-sm font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>Sunrise Tutoring</div>
          <div className="text-xs text-muted-foreground">Phoenix, AZ</div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2">
        <span className="rounded-full bg-violet px-3 py-1 text-xs font-semibold text-white" style={{ borderRadius: "var(--radius-card)" }}>Selected</span>
        <span className="rounded-full border border-border-strong px-3 py-1 text-xs font-semibold text-ink" style={{ borderRadius: "var(--radius-card)" }}>Unselected</span>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <span className="inline-flex items-center bg-indigo px-3 py-1.5 text-xs font-semibold text-white" style={{ borderRadius: "var(--radius-card)" }}>Primary</span>
        <span className="inline-flex items-center border border-border-strong px-3 py-1.5 text-xs font-semibold text-ink" style={{ borderRadius: "var(--radius-card)" }}>Secondary</span>
      </div>

      {/* Alert */}
      <div className="border border-warm-border bg-warm px-3 py-2 text-xs text-[#7a5a1e]" style={{ borderRadius: "var(--radius-card)" }}>
        Heads up — your listing is pending review.
      </div>

      {/* Sticky strength bar */}
      <div className="flex items-center gap-3 border border-border bg-card px-3 py-2" style={{ borderRadius: "var(--radius-card)" }}>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg">
          <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-indigo to-violet" />
        </div>
        <span className="inline-flex items-center bg-violet px-3 py-1 text-xs font-semibold text-white" style={{ borderRadius: "var(--radius-card)" }}>Publish</span>
      </div>
    </div>
  );
}
