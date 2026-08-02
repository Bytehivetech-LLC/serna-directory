"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils/format";
import { GUIDED_PROVIDERS } from "@/lib/scripts/providers";
import type { ScriptRow } from "@/lib/admin/scripts-queries";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionCard } from "@/components/layout/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createGuidedScriptAction,
  createCustomScriptAction,
  toggleScriptAction,
  deleteScriptAction,
} from "@/lib/admin/scripts-actions";
import { updateConsentBannerAction } from "@/lib/admin/settings-actions";

export function ScriptsTab({ scripts, bannerEnabled }: { scripts: ScriptRow[]; bannerEnabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) { if (res.message) toast.success(res.message); after?.(); router.refresh(); }
      else toast.error(res.error);
    });
  }

  return (
    <Tabs defaultValue="guided" className="w-full">
      <div className="mb-4 flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-ink">Cookie consent banner</div>
          <div className="text-xs text-muted-foreground">When on, analytics & marketing scripts wait for visitor consent.</div>
        </div>
        <Switch checked={bannerEnabled} disabled={pending} onCheckedChange={(v) => run(() => updateConsentBannerAction(v))} aria-label="Consent banner" />
      </div>

      <TabsList>
        <TabsTrigger value="guided">Integrations</TabsTrigger>
        <TabsTrigger value="custom">Custom code</TabsTrigger>
      </TabsList>

      <TabsContent value="guided" className="mt-6">
        <Guided run={run} pending={pending} />
      </TabsContent>
      <TabsContent value="custom" className="mt-6">
        <Custom scripts={scripts.filter((s) => s.kind === "custom")} run={run} pending={pending} />
      </TabsContent>

      {/* Active/guided script list (both kinds) */}
      <div className="mt-6">
        <ScriptList scripts={scripts} run={run} pending={pending} />
      </div>
    </Tabs>
  );
}

function Guided({ run, pending }: { run: (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) => void; pending: boolean }) {
  const [ids, setIds] = useState<Record<string, string>>({});
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {GUIDED_PROVIDERS.map((p) => (
        <div key={p.kind} className="rounded-xl border border-border bg-card p-4">
          <div className="font-semibold text-ink">{p.label}</div>
          <div className="mt-2 flex gap-2">
            <Input
              value={ids[p.kind] ?? ""}
              onChange={(e) => setIds((prev) => ({ ...prev, [p.kind]: e.target.value }))}
              placeholder={p.placeholder}
            />
            <Button
              disabled={pending || !(ids[p.kind] ?? "").trim()}
              onClick={() => run(() => createGuidedScriptAction(p.kind, ids[p.kind] ?? ""), () => setIds((prev) => ({ ...prev, [p.kind]: "" })))}
            >
              Add
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

const ACK_KEY = "serna-custom-script-ack";

function Custom({ scripts, run, pending }: { scripts: ScriptRow[]; run: (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [ackOpen, setAckOpen] = useState(false);
  const [ackText, setAckText] = useState("");
  const [f, setF] = useState({ name: "", code: "", placement: "head", applies_to: "all", consent_group: "analytics", external_hosts: "", notes: "" });

  function startNew() {
    const acked = typeof window !== "undefined" && localStorage.getItem(ACK_KEY) === "1";
    if (acked) setOpen(true);
    else setAckOpen(true);
  }

  function submit() {
    run(() => createCustomScriptAction({
      ...f,
      external_hosts: f.external_hosts.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean),
    }), () => { setOpen(false); setF({ name: "", code: "", placement: "head", applies_to: "all", consent_group: "analytics", external_hosts: "", notes: "" }); });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{scripts.length} custom {scripts.length === 1 ? "script" : "scripts"}.</p>
        <Button onClick={startNew}><Plus className="h-4 w-4" /> New custom script</Button>
      </div>

      {/* One-time acknowledgement */}
      <Dialog open={ackOpen} onOpenChange={setAckOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display"><AlertTriangle className="h-5 w-5 text-danger" /> Before you paste code</DialogTitle>
            <DialogDescription>
              This code runs in <b className="text-ink">every visitor&apos;s browser</b>. We cannot verify it&apos;s safe. Only paste code from a source you trust. Type <b className="text-ink">I understand</b> to continue.
            </DialogDescription>
          </DialogHeader>
          <Input value={ackText} onChange={(e) => setAckText(e.target.value)} placeholder="I understand" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAckOpen(false)}>Cancel</Button>
            <Button disabled={ackText.trim() !== "I understand"} onClick={() => { localStorage.setItem(ACK_KEY, "1"); setAckOpen(false); setAckText(""); setOpen(true); }}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editor */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle className="font-display">New custom script</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Name</Label><Input value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Placement</Label>
                <select value={f.placement} onChange={(e) => setF((p) => ({ ...p, placement: e.target.value }))} className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-ink">
                  <option value="head">Head</option><option value="body_start">Start of body</option><option value="body_end">End of body</option>
                </select>
              </div>
              <div className="space-y-1.5"><Label>Consent group</Label>
                <select value={f.consent_group} onChange={(e) => setF((p) => ({ ...p, consent_group: e.target.value }))} className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-ink">
                  <option value="essential">Essential</option><option value="analytics">Analytics</option><option value="marketing">Marketing</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Applies to (path prefix or “all”)</Label><Input value={f.applies_to} onChange={(e) => setF((p) => ({ ...p, applies_to: e.target.value }))} placeholder="all, /, /listing" /></div>
            <div className="space-y-1.5"><Label>External hosts it contacts (space/comma separated)</Label><Input value={f.external_hosts} onChange={(e) => setF((p) => ({ ...p, external_hosts: e.target.value }))} placeholder="https://example.com" /></div>
            <div className="space-y-1.5"><Label>Code</Label><Textarea rows={7} value={f.code} onChange={(e) => setF((p) => ({ ...p, code: e.target.value }))} className="font-mono text-xs" /></div>
            <div className="space-y-1.5"><Label>Notes</Label><Input value={f.notes} onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={pending || !f.name.trim() || !f.code.trim()} onClick={submit}>Save (inactive)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScriptList({ scripts, run, pending }: { scripts: ScriptRow[]; run: (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) => void; pending: boolean }) {
  if (!scripts.length) return null;
  return (
    <SectionCard title="All scripts">
      <ul className="divide-y divide-border">
        {scripts.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink">{s.name}</span>
                <Badge variant="secondary">{s.placement}</Badge>
                <Badge variant="outline">{s.consent_group}</Badge>
              </div>
              <div className="text-xs text-faint">Applies to {s.applies_to} · edited {formatDate(s.updated_at)}</div>
            </div>
            <div className="flex items-center gap-3">
              {s.is_active && s.applies_to ? (
                <a href={s.applies_to === "all" ? "/" : s.applies_to} target="_blank" rel="noreferrer" className="text-xs text-indigo hover:underline">Preview</a>
              ) : null}
              <span title={!s.is_active ? "Preview before activating" : undefined}>
                <Switch checked={s.is_active} disabled={pending} onCheckedChange={(v) => run(() => toggleScriptAction(s.id, v))} aria-label="Active" />
              </span>
              <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => run(() => deleteScriptAction(s.id))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
