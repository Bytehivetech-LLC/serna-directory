import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { runDeepHealthCheck } from "@/lib/admin/health-check";
import { PageHeading } from "@/components/layout/page-heading";
import { SectionCard } from "@/components/layout/section-card";

export const metadata: Metadata = { title: "System check" };
export const dynamic = "force-dynamic";

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      className={
        ok
          ? "inline-block h-2.5 w-2.5 rounded-full bg-good"
          : "inline-block h-2.5 w-2.5 rounded-full bg-danger"
      }
      aria-hidden
    />
  );
}

function Row({ label, value }: { label: string; value: boolean | string }) {
  const ok = value === true;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0">
      <span className="font-mono text-xs text-ink">{label}</span>
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        {typeof value === "string" ? value : ok ? "ok" : "missing"}
        <Dot ok={ok} />
      </span>
    </div>
  );
}

export default async function SystemCheckPage() {
  await requireAdmin();
  const h = await runDeepHealthCheck();

  return (
    <div className="space-y-6">
      <PageHeading
        title="System check"
        lede="Environment, database, storage and migration status for this deployment."
      />

      <div
        className={
          h.ok
            ? "rounded-xl border border-good/30 bg-good-soft px-5 py-3 text-sm font-semibold text-good"
            : "rounded-xl border border-danger/30 bg-danger-soft px-5 py-3 text-sm font-semibold text-danger"
        }
      >
        {h.ok ? "All checks passed." : "Some checks failed — see below."}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Supabase">
          <Row label="anon key reachable" value={h.supabase.anon} />
          <Row label="service role reachable" value={h.supabase.service} />
        </SectionCard>

        <SectionCard title="Storage buckets">
          {Object.entries(h.buckets).map(([k, v]) => (
            <Row key={k} label={k} value={v} />
          ))}
        </SectionCard>

        <SectionCard title="Database functions (RPCs)">
          {Object.entries(h.rpcs).map(([k, v]) => (
            <Row key={k} label={k} value={v} />
          ))}
        </SectionCard>

        <SectionCard title="Migration markers">
          {Object.entries(h.migrationMarkers).map(([k, v]) => (
            <Row key={k} label={k} value={v} />
          ))}
          <p className="mt-2 text-xs text-faint">{h.note}</p>
        </SectionCard>

        <SectionCard title="Environment variables (presence only)" className="lg:col-span-2">
          <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            {Object.entries(h.env).map(([k, v]) => (
              <Row key={k} label={k} value={v} />
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
