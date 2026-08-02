"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ADDON_EFFECTS, type AddonEffect } from "@/lib/addons/effects";
import { SectionCard } from "@/components/layout/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  createAddonAction,
  updateAddonAction,
  reconcileAddonAction,
  signAddonImageUploadAction,
  setAddonImageAction,
  type AddonInput,
} from "@/lib/admin/addons-actions";
import type { Addon } from "@/types";

type Lookup = { id: string; name: string };

export function AddonForm({
  mode,
  addon,
  packages,
}: {
  mode: "create" | "edit";
  addon?: Addon;
  packages: Lookup[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [drift, setDrift] = useState<string[] | null>(null);
  const [imageUrl, setImageUrl] = useState(addon?.image_url ?? "");

  const [f, setF] = useState({
    name: addon?.name ?? "",
    slug: addon?.slug ?? "",
    short_description: addon?.short_description ?? "",
    description: addon?.description ?? "",
    price: addon ? String((addon.price_cents ?? 0) / 100) : "0",
    currency: addon?.currency ?? "usd",
    interval: String(addon?.interval ?? "one_time"),
    duration_days: addon?.duration_days == null ? "" : String(addon.duration_days),
    effect: String(addon?.effect ?? "manual"),
    effect_value: String(addon?.effect_value ?? 0),
    max_quantity: String(addon?.max_quantity ?? 1),
    fulfilment_note: addon?.fulfilment_note ?? "",
    badge_label: addon?.badge_label ?? "",
    is_active: addon?.is_active ?? true,
    is_public: addon?.is_public ?? true,
  });
  const [packageIds, setPackageIds] = useState<string[]>(
    Array.isArray(addon?.package_ids) ? (addon!.package_ids as string[]) : [],
  );

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  const effectMeta = ADDON_EFFECTS.find((e) => e.value === f.effect);

  function buildInput(): AddonInput {
    return {
      name: f.name.trim(),
      slug: f.slug.trim() || undefined,
      short_description: f.short_description.trim() || null,
      description: f.description.trim() || null,
      price_cents: Math.max(0, Math.round(Number(f.price) * 100) || 0),
      currency: f.currency.trim() || "usd",
      interval: f.interval as AddonInput["interval"],
      duration_days: f.duration_days.trim() === "" ? null : Number(f.duration_days),
      effect: f.effect as AddonEffect,
      effect_value: Number(f.effect_value) || 0,
      max_quantity: Number(f.max_quantity) || 1,
      package_ids: packageIds,
      fulfilment_note: f.fulfilment_note.trim() || null,
      badge_label: f.badge_label.trim() || null,
      is_active: f.is_active,
      is_public: f.is_public,
    };
  }

  function save() {
    startTransition(async () => {
      const input = buildInput();
      const res =
        mode === "create"
          ? await createAddonAction(input)
          : await updateAddonAction(addon!.id, input);
      if (res.ok) {
        toast.success(mode === "create" ? "Add-on created." : "Add-on saved.");
        if (res.warning) toast.warning(res.warning, { duration: 12000 });
        router.push("/admin/addons");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function syncFromStripe() {
    if (!addon) return;
    startTransition(async () => {
      const res = await reconcileAddonAction(addon.id);
      setDrift(res.messages);
      if (res.ok) toast.success("Reconciled with Stripe.");
      router.refresh();
    });
  }

  async function onImageFile(file: File) {
    if (!addon) return;
    const ext = file.name.split(".").pop() ?? "png";
    startTransition(async () => {
      const signed = await signAddonImageUploadAction(addon.id, ext);
      if (!signed.ok) {
        toast.error(signed.error);
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("site-assets")
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
      if (error) {
        toast.error("Upload failed.");
        return;
      }
      const saved = await setAddonImageAction(addon.id, signed.path);
      if (saved.ok) {
        toast.success("Image updated.");
        setImageUrl(
          supabase.storage.from("site-assets").getPublicUrl(signed.path).data.publicUrl,
        );
        router.refresh();
      } else toast.error(saved.error);
    });
  }

  const togglePackage = (id: string) =>
    setPackageIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <SectionCard title="Basics">
          <div className="space-y-4">
            <Row>
              <FieldEl label="Name">
                <Input value={f.name} onChange={(e) => set("name", e.target.value)} />
              </FieldEl>
              <FieldEl label="Slug (optional)">
                <Input value={f.slug} onChange={(e) => set("slug", e.target.value)} placeholder="auto" />
              </FieldEl>
            </Row>
            <FieldEl label="One-line description (picker card)">
              <Input
                value={f.short_description}
                onChange={(e) => set("short_description", e.target.value)}
                placeholder="e.g. Featured in our weekly newsletter"
              />
            </FieldEl>
            <FieldEl label="Longer description (info popover)">
              <Textarea
                rows={3}
                value={f.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </FieldEl>
          </div>
        </SectionCard>

        <SectionCard title="Pricing">
          <div className="space-y-4">
            <Row>
              <FieldEl label="Price">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={f.price}
                    onChange={(e) => set("price", e.target.value)}
                  />
                </div>
              </FieldEl>
              <FieldEl label="Currency">
                <Input
                  value={f.currency}
                  onChange={(e) => set("currency", e.target.value)}
                  maxLength={3}
                  className="uppercase"
                />
              </FieldEl>
            </Row>
            <Row>
              <FieldEl label="Interval">
                <Sel
                  value={f.interval}
                  onChange={(v) => set("interval", v)}
                  options={[
                    { value: "one_time", label: "One-time" },
                    { value: "month", label: "Monthly" },
                    { value: "year", label: "Yearly" },
                  ]}
                />
              </FieldEl>
              <FieldEl label="Duration days (blank = permanent)">
                <Input
                  type="number"
                  min="1"
                  value={f.duration_days}
                  onChange={(e) => set("duration_days", e.target.value)}
                  placeholder="permanent"
                />
              </FieldEl>
            </Row>
            <p className="text-xs text-faint">
              Prices are immutable in Stripe — changing the price mints a new price and
              archives the old. Existing buyers keep their price.
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Effect" description="What buying it actually changes.">
          <div className="space-y-4">
            <FieldEl label="Effect">
              <Sel
                value={f.effect}
                onChange={(v) => set("effect", v)}
                options={ADDON_EFFECTS.map((e) => ({ value: e.value, label: e.label }))}
              />
            </FieldEl>
            {effectMeta ? <p className="text-xs text-muted-foreground">{effectMeta.hint}</p> : null}
            <Row>
              {effectMeta?.needsValue ? (
                <FieldEl label="Effect value">
                  <Input
                    type="number"
                    min="0"
                    value={f.effect_value}
                    onChange={(e) => set("effect_value", e.target.value)}
                  />
                </FieldEl>
              ) : null}
              <FieldEl label="Max quantity per listing">
                <Input
                  type="number"
                  min="1"
                  value={f.max_quantity}
                  onChange={(e) => set("max_quantity", e.target.value)}
                />
              </FieldEl>
            </Row>
            {f.effect === "manual" ? (
              <FieldEl label="Fulfilment note (shown in your queue)">
                <Textarea
                  rows={2}
                  value={f.fulfilment_note}
                  onChange={(e) => set("fulfilment_note", e.target.value)}
                  placeholder="e.g. Add to the next Friday newsletter; needs a 600×400 image."
                />
              </FieldEl>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="Availability" description="Empty = available with every package.">
          <div className="flex flex-wrap gap-3">
            {packages.length ? (
              packages.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm text-ink">
                  <Checkbox
                    checked={packageIds.includes(p.id)}
                    onCheckedChange={() => togglePackage(p.id)}
                  />
                  {p.name}
                </label>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No packages yet.</p>
            )}
          </div>
        </SectionCard>
      </div>

      <div className="space-y-6">
        <SectionCard title="Visibility">
          <div className="space-y-4">
            <ToggleRow label="Active" checked={f.is_active} onChange={(v) => set("is_active", v)} />
            <ToggleRow
              label="Publicly purchasable"
              checked={f.is_public}
              onChange={(v) => set("is_public", v)}
            />
            <FieldEl label="Badge label (optional)">
              <Input
                value={f.badge_label}
                onChange={(e) => set("badge_label", e.target.value)}
                placeholder="e.g. Popular"
              />
            </FieldEl>
          </div>
        </SectionCard>

        <SectionCard title="Card image">
          {mode === "edit" ? (
            <div className="space-y-3">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt=""
                  className="h-32 w-full rounded-lg border border-border object-cover"
                />
              ) : (
                <p className="text-sm text-muted-foreground">No image yet.</p>
              )}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-secondary">
                <Upload className="h-4 w-4" /> Upload image
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onImageFile(file);
                  }}
                />
              </label>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Save the add-on first, then add a card image.
            </p>
          )}
        </SectionCard>

        {mode === "edit" ? (
          <SectionCard title="Stripe">
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Product: {addon?.stripe_product_id ?? "—"}
                <br />
                Price: {addon?.stripe_price_id ?? "—"}
              </p>
              <Button type="button" variant="outline" size="sm" disabled={pending} onClick={syncFromStripe}>
                <RefreshCw className="h-4 w-4" /> Sync from Stripe
              </Button>
              {drift ? (
                <ul className="space-y-1 rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
                  {drift.map((m, i) => (
                    <li key={i}>• {m}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </SectionCard>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-4 lg:col-span-3">
        <Button asChild variant="ghost">
          <Link href="/admin/addons">Cancel</Link>
        </Button>
        <Button onClick={save} disabled={pending} size="lg">
          {mode === "create" ? "Create add-on" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}
function FieldEl({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
function Sel({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
