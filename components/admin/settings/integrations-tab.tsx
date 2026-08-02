"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle, ExternalLink, AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/utils/format";
import { executeRecaptcha } from "@/lib/security/recaptcha-client";
import type { IntegrationPanel } from "@/lib/admin/integrations-queries";
import type { StripeStatus } from "@/lib/stripe/status";
import { SectionCard } from "@/components/layout/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSecretSave } from "./use-secret-save";
import {
  saveSendgridAction,
  testSendgridAction,
  saveRecaptchaAction,
  testRecaptchaAction,
  saveMapsAction,
  testMapsAction,
} from "@/lib/admin/integrations-actions";

const str = (o: Record<string, unknown>, k: string, d = "") => (typeof o[k] === "string" ? (o[k] as string) : d);
const nnum = (o: Record<string, unknown>, k: string, d: number) => (typeof o[k] === "number" ? (o[k] as number) : d);

function StatusPill({ i }: { i: IntegrationPanel }) {
  const failed = i.lastErrorAt && (!i.lastSuccessAt || new Date(i.lastErrorAt) > new Date(i.lastSuccessAt));
  if (failed) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-bold text-danger"><AlertTriangle className="h-3 w-3" /> Last call failed</span>;
  }
  if (i.enabled && (i.hasSecret || Object.keys(i.publicConfig).length)) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-good-soft px-2.5 py-0.5 text-xs font-bold text-good"><CheckCircle2 className="h-3 w-3" /> Connected</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-muted-foreground"><Circle className="h-3 w-3" /> Not configured</span>;
}

function Meta({ i }: { i: IntegrationPanel }) {
  return (
    <p className="text-xs text-faint">
      {i.lastSuccessAt ? `Last used ${formatDate(i.lastSuccessAt)}. ` : ""}
      {i.lastErrorMessage ? <span className="text-danger">Error: {i.lastErrorMessage}</span> : null}
    </p>
  );
}

function KeyField({ i, value, onChange, replacing, setReplacing, label }: {
  i: IntegrationPanel; value: string; onChange: (v: string) => void; replacing: boolean; setReplacing: (b: boolean) => void; label: string;
}) {
  if (i.hasSecret && !replacing) {
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Configured · ends {i.hint ?? "••••"}
            {i.secretUpdatedAt ? ` · updated ${formatDate(i.secretUpdatedAt)}` : ""}
            {i.secretUpdatedByEmail ? ` by ${i.secretUpdatedByEmail}` : ""}
          </span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => setReplacing(true)}>Replace key</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="password" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Paste the key" />
      {i.hasSecret ? <button type="button" className="text-xs text-muted-foreground hover:text-ink" onClick={() => { setReplacing(false); onChange(""); }}>Keep existing key</button> : null}
    </div>
  );
}

export function IntegrationsTab({ integrations, stripe }: { integrations: IntegrationPanel[]; stripe: StripeStatus }) {
  const byProvider = new Map(integrations.map((i) => [i.provider, i]));
  return (
    <div className="max-w-2xl space-y-6">
      <SendgridCard i={byProvider.get("sendgrid")!} />
      <RecaptchaCard i={byProvider.get("recaptcha")!} />
      <MapsCard i={byProvider.get("google_maps")!} />
      <StripeCard stripe={stripe} />
    </div>
  );
}

function SendgridCard({ i }: { i: IntegrationPanel }) {
  const { save, pending, MfaDialog } = useSecretSave();
  const pc = i.publicConfig;
  const [f, setF] = useState({
    from_email: str(pc, "from_email", process.env.NEXT_PUBLIC_DEFAULT_FROM ?? ""),
    from_name: str(pc, "from_name", "Serna Educational Services"),
    recipients: Array.isArray(pc.recipients) ? (pc.recipients as string[]).join(", ") : "",
    api_key: "",
    enabled: i.enabled,
  });
  const [replacing, setReplacing] = useState(false);

  return (
    <SectionCard title="SendGrid" actions={<StatusPill i={i} />}>
      <div className="space-y-4">
        <Meta i={i} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>From email</Label><Input type="email" value={f.from_email} onChange={(e) => setF((p) => ({ ...p, from_email: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>From name</Label><Input value={f.from_name} onChange={(e) => setF((p) => ({ ...p, from_name: e.target.value }))} /></div>
        </div>
        <div className="space-y-1.5"><Label>Admin notification recipients (comma separated)</Label><Input value={f.recipients} onChange={(e) => setF((p) => ({ ...p, recipients: e.target.value }))} /></div>
        <KeyField i={i} label="API key" value={f.api_key} onChange={(v) => setF((p) => ({ ...p, api_key: v }))} replacing={replacing} setReplacing={setReplacing} />
        <div className="flex items-center justify-between"><span className="text-sm font-semibold text-ink">Enabled</span><Switch checked={f.enabled} onCheckedChange={(v) => setF((p) => ({ ...p, enabled: v }))} aria-label="Enabled" /></div>
        <div className="flex justify-between">
          <Button variant="outline" disabled={pending} onClick={() => save(() => testSendgridAction())}>Send test email</Button>
          <Button disabled={pending} onClick={() => save(() => saveSendgridAction({
            from_email: f.from_email, from_name: f.from_name,
            recipients: f.recipients.split(",").map((s) => s.trim()).filter(Boolean),
            api_key: f.api_key || undefined, enabled: f.enabled,
          }), () => { setReplacing(false); setF((p) => ({ ...p, api_key: "" })); })}>Save</Button>
        </div>
      </div>
      {MfaDialog}
    </SectionCard>
  );
}

function RecaptchaCard({ i }: { i: IntegrationPanel }) {
  const { save, pending, MfaDialog } = useSecretSave();
  const pc = i.publicConfig;
  const FORMS = ["list_program", "contact", "register", "login"];
  const [f, setF] = useState({
    site_key: str(pc, "site_key"),
    min_score: nnum(pc, "min_score", 0.5),
    review_score: nnum(pc, "review_score", 0.3),
    guarded_forms: Array.isArray(pc.guarded_forms) ? (pc.guarded_forms as string[]) : FORMS.slice(0, 3),
    secret_key: "",
    enabled: i.enabled,
  });
  const [replacing, setReplacing] = useState(false);

  async function test() {
    const token = await executeRecaptcha("integration_test");
    if (!token) return toast.error("Couldn't run a challenge — set the site key and reload.");
    save(() => testRecaptchaAction(token));
  }

  return (
    <SectionCard title="Google reCAPTCHA v3" actions={<StatusPill i={i} />}>
      <div className="space-y-4">
        <Meta i={i} />
        <div className="space-y-1.5"><Label>Site key (public)</Label><Input value={f.site_key} onChange={(e) => setF((p) => ({ ...p, site_key: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>Minimum passing score</Label><Input type="number" step="0.05" min="0" max="1" value={f.min_score} onChange={(e) => setF((p) => ({ ...p, min_score: Number(e.target.value) }))} /></div>
          <div className="space-y-1.5"><Label>Hold-for-review score</Label><Input type="number" step="0.05" min="0" max="1" value={f.review_score} onChange={(e) => setF((p) => ({ ...p, review_score: Number(e.target.value) }))} /></div>
        </div>
        <div className="space-y-2">
          <Label>Guards which forms</Label>
          <div className="flex flex-wrap gap-3">
            {FORMS.map((form) => (
              <label key={form} className="flex items-center gap-1.5 text-sm text-ink">
                <input type="checkbox" checked={f.guarded_forms.includes(form)} onChange={(e) => setF((p) => ({ ...p, guarded_forms: e.target.checked ? [...p.guarded_forms, form] : p.guarded_forms.filter((x) => x !== form) }))} />
                {form}
              </label>
            ))}
          </div>
        </div>
        <KeyField i={i} label="Secret key" value={f.secret_key} onChange={(v) => setF((p) => ({ ...p, secret_key: v }))} replacing={replacing} setReplacing={setReplacing} />
        <div className="flex items-center justify-between"><span className="text-sm font-semibold text-ink">Enabled</span><Switch checked={f.enabled} onCheckedChange={(v) => setF((p) => ({ ...p, enabled: v }))} aria-label="Enabled" /></div>
        <div className="flex justify-between">
          <Button variant="outline" disabled={pending} onClick={test}>Test verification</Button>
          <Button disabled={pending} onClick={() => save(() => saveRecaptchaAction({
            site_key: f.site_key, min_score: f.min_score, review_score: f.review_score,
            guarded_forms: f.guarded_forms, secret_key: f.secret_key || undefined, enabled: f.enabled,
          }), () => { setReplacing(false); setF((p) => ({ ...p, secret_key: "" })); })}>Save</Button>
        </div>
      </div>
      {MfaDialog}
    </SectionCard>
  );
}

function MapsCard({ i }: { i: IntegrationPanel }) {
  const { save, pending, MfaDialog } = useSecretSave();
  const pc = i.publicConfig;
  const center = (pc.center ?? {}) as { lat?: number; lng?: number };
  const [f, setF] = useState({
    browser_key: str(pc, "browser_key"),
    lat: center.lat ?? 33.4484,
    lng: center.lng ?? -112.074,
    zoom: nnum(pc, "zoom", 10),
    enabled: i.enabled,
  });

  return (
    <SectionCard title="Google Maps" actions={<StatusPill i={i} />}>
      <div className="space-y-4">
        <Meta i={i} />
        <div className="space-y-1.5"><Label>Browser API key (public)</Label><Input value={f.browser_key} onChange={(e) => setF((p) => ({ ...p, browser_key: e.target.value }))} placeholder="AIza…" /></div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5"><Label>Centre lat</Label><Input type="number" step="0.0001" value={f.lat} onChange={(e) => setF((p) => ({ ...p, lat: Number(e.target.value) }))} /></div>
          <div className="space-y-1.5"><Label>Centre lng</Label><Input type="number" step="0.0001" value={f.lng} onChange={(e) => setF((p) => ({ ...p, lng: Number(e.target.value) }))} /></div>
          <div className="space-y-1.5"><Label>Zoom</Label><Input type="number" min="1" max="20" value={f.zoom} onChange={(e) => setF((p) => ({ ...p, zoom: Number(e.target.value) }))} /></div>
        </div>
        <div className="flex items-center justify-between"><span className="text-sm font-semibold text-ink">Enabled</span><Switch checked={f.enabled} onCheckedChange={(v) => setF((p) => ({ ...p, enabled: v }))} aria-label="Enabled" /></div>
        <div className="flex justify-between">
          <Button variant="outline" disabled={pending} onClick={() => save(() => testMapsAction(f.browser_key))}>Test</Button>
          <Button disabled={pending} onClick={() => save(() => saveMapsAction(f))}>Save</Button>
        </div>
      </div>
      {MfaDialog}
    </SectionCard>
  );
}

function StripeCard({ stripe }: { stripe: StripeStatus }) {
  return (
    <SectionCard title="Stripe" actions={
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${stripe.mode === "live" ? "bg-good-soft text-good" : "bg-violet-soft text-violet"}`}>
        {stripe.mode ?? "not configured"} mode
      </span>
    }>
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Account: <span className="font-semibold text-ink">{stripe.accountName ?? "—"}</span>
        </p>
        <p className="text-muted-foreground">
          Webhook: {stripe.webhook.lastEventAt ? `last event ${formatDate(stripe.webhook.lastEventAt)}` : "no events yet"}
        </p>
        <div className="rounded-lg border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
          The Stripe secret key stays in environment variables and is <b className="text-ink">managed in Vercel</b> — a leaked secret here would let anyone move money, so it never lives in the database.{" "}
          <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo hover:underline">Open Vercel <ExternalLink className="h-3 w-3" /></a>
        </div>
      </div>
    </SectionCard>
  );
}
