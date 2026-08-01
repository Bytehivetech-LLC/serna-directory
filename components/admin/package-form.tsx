"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/layout/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  createPackageAction,
  updatePackageAction,
  reconcilePackageAction,
  type PackageInput,
} from "@/lib/admin/packages-actions";
import type { Package } from "@/types";

type Props = { mode: "create" | "edit"; pkg?: Package };

const asStr = (v: unknown) => (v == null ? "" : String(v));

export function PackageForm({ mode, pkg }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [drift, setDrift] = useState<string[] | null>(null);

  const [f, setF] = useState({
    name: pkg?.name ?? "",
    slug: pkg?.slug ?? "",
    tagline: pkg?.tagline ?? "",
    description: pkg?.description ?? "",
    price: pkg ? String((pkg.price_cents ?? 0) / 100) : "0",
    currency: pkg?.currency ?? "usd",
    interval: String(pkg?.interval ?? "month"),
    trial_days: asStr(pkg?.trial_days ?? 0),
    min_listings: asStr(pkg?.min_listings ?? 1),
    max_listings: pkg?.max_listings == null ? "" : String(pkg.max_listings),
    max_images: asStr(pkg?.max_images ?? 8),
    requires_approval: pkg?.requires_approval ?? true,
    allows_featured: pkg?.allows_featured ?? false,
    priority_rank: asStr(pkg?.priority_rank ?? 0),
    badge_label: pkg?.badge_label ?? "",
    badge_color: pkg?.badge_color ?? "#6c4ce8",
    is_active: pkg?.is_active ?? true,
    is_public: pkg?.is_public ?? true,
    is_default: pkg?.is_default ?? false,
  });
  const [features, setFeatures] = useState<string[]>(
    Array.isArray(pkg?.features) ? (pkg!.features as string[]) : [],
  );

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  function buildInput(): PackageInput {
    return {
      name: f.name.trim(),
      slug: f.slug.trim() || undefined,
      tagline: f.tagline.trim() || null,
      description: f.description.trim() || null,
      price_cents: Math.max(0, Math.round(Number(f.price) * 100) || 0),
      currency: f.currency.trim() || "usd",
      interval: f.interval as PackageInput["interval"],
      trial_days: Number(f.trial_days) || 0,
      min_listings: Number(f.min_listings) || 0,
      max_listings: f.max_listings.trim() === "" ? null : Number(f.max_listings),
      max_images: Number(f.max_images) || 0,
      requires_approval: f.requires_approval,
      allows_featured: f.allows_featured,
      priority_rank: Number(f.priority_rank) || 0,
      badge_label: f.badge_label.trim() || null,
      badge_color: f.badge_label.trim() ? f.badge_color : null,
      features: features.map((x) => x.trim()).filter(Boolean),
      is_active: f.is_active,
      is_public: f.is_public,
      is_default: f.is_default,
    };
  }

  function save() {
    startTransition(async () => {
      const input = buildInput();
      const res =
        mode === "create"
          ? await createPackageAction(input)
          : await updatePackageAction(pkg!.id, input);
      if (res.ok) {
        toast.success(mode === "create" ? "Package created." : "Package saved.");
        if (res.warning) toast.warning(res.warning, { duration: 12000 });
        router.push("/admin/packages");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function syncFromStripe() {
    if (!pkg) return;
    startTransition(async () => {
      const res = await reconcilePackageAction(pkg.id);
      setDrift(res.messages);
      if (res.ok) toast.success("Reconciled with Stripe.");
      else toast.error(res.messages[0] ?? "Couldn't reconcile.");
      router.refresh();
    });
  }

  const recurring = f.interval !== "one_time";

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
                <Input
                  value={f.slug}
                  onChange={(e) => set("slug", e.target.value)}
                  placeholder="auto from name"
                />
              </FieldEl>
            </Row>
            <FieldEl label="Tagline">
              <Input value={f.tagline} onChange={(e) => set("tagline", e.target.value)} />
            </FieldEl>
            <FieldEl label="Description">
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
              <FieldEl label="Trial days">
                <Input
                  type="number"
                  min="0"
                  value={f.trial_days}
                  onChange={(e) => set("trial_days", e.target.value)}
                  disabled={!recurring}
                />
              </FieldEl>
            </Row>
            <p className="text-xs text-faint">
              Stripe prices are immutable — changing the price mints a new Stripe price
              and archives the old one. Existing subscribers keep their price until they
              resubscribe.
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Limits & perks">
          <div className="space-y-4">
            <Row>
              <FieldEl label="Min listings">
                <Input
                  type="number"
                  min="0"
                  value={f.min_listings}
                  onChange={(e) => set("min_listings", e.target.value)}
                />
              </FieldEl>
              <FieldEl label="Max listings (blank = unlimited)">
                <Input
                  type="number"
                  min="1"
                  value={f.max_listings}
                  onChange={(e) => set("max_listings", e.target.value)}
                  placeholder="unlimited"
                />
              </FieldEl>
            </Row>
            <Row>
              <FieldEl label="Max images">
                <Input
                  type="number"
                  min="0"
                  value={f.max_images}
                  onChange={(e) => set("max_images", e.target.value)}
                />
              </FieldEl>
              <FieldEl label="Priority rank (higher = higher in results)">
                <Input
                  type="number"
                  min="0"
                  value={f.priority_rank}
                  onChange={(e) => set("priority_rank", e.target.value)}
                />
              </FieldEl>
            </Row>
            <ToggleRow
              label="Requires admin approval"
              hint="Listings on this tier go to the review queue before publishing."
              checked={f.requires_approval}
              onChange={(v) => set("requires_approval", v)}
            />
            <ToggleRow
              label="Allows featured placement"
              hint="Listings can be featured on the homepage and top of results."
              checked={f.allows_featured}
              onChange={(v) => set("allows_featured", v)}
            />
          </div>
        </SectionCard>

        <SectionCard title="Feature bullets" description="Shown on the pricing cards.">
          <div className="space-y-2">
            {features.map((feat, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={feat}
                  onChange={(e) =>
                    setFeatures((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
                  }
                  placeholder="e.g. Up to 10 photos"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove bullet"
                  onClick={() => setFeatures((prev) => prev.filter((_, j) => j !== i))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFeatures((prev) => [...prev, ""])}
            >
              <Plus className="h-4 w-4" /> Add bullet
            </Button>
          </div>
        </SectionCard>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        <SectionCard title="Visibility">
          <div className="space-y-4">
            <ToggleRow label="Active" checked={f.is_active} onChange={(v) => set("is_active", v)} />
            <ToggleRow
              label="Publicly selectable"
              hint="Shown on the pricing page and in the listing form."
              checked={f.is_public}
              onChange={(v) => set("is_public", v)}
            />
            <ToggleRow
              label="Default package"
              hint="New free listings land here. Only one tier can be default."
              checked={f.is_default}
              onChange={(v) => set("is_default", v)}
            />
          </div>
        </SectionCard>

        <SectionCard title="Badge">
          <div className="space-y-4">
            <FieldEl label="Badge label (optional)">
              <Input
                value={f.badge_label}
                onChange={(e) => set("badge_label", e.target.value)}
                placeholder="e.g. Most popular"
              />
            </FieldEl>
            <FieldEl label="Badge colour">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={f.badge_color}
                  onChange={(e) => set("badge_color", e.target.value)}
                  aria-label="Badge colour"
                  className="h-9 w-10 rounded border border-border"
                />
                <Input
                  value={f.badge_color}
                  onChange={(e) => set("badge_color", e.target.value)}
                  className="uppercase"
                />
              </div>
            </FieldEl>
            {f.badge_label ? (
              <span
                className="inline-block rounded px-2 py-0.5 text-xs font-bold text-white"
                style={{ backgroundColor: f.badge_color }}
              >
                {f.badge_label}
              </span>
            ) : null}
          </div>
        </SectionCard>

        {mode === "edit" ? (
          <SectionCard title="Stripe">
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Product: {pkg?.stripe_product_id ?? "—"}
                <br />
                Price: {pkg?.stripe_price_id ?? "—"}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={syncFromStripe}
              >
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
          <Link href="/admin/packages">Cancel</Link>
        </Button>
        <Button onClick={save} disabled={pending} size="lg">
          {mode === "create" ? "Create package" : "Save changes"}
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
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-ink">{label}</div>
        {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
      </div>
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
