"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Monitor, RotateCcw, Send, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils/format";
import { sampleContext } from "@/lib/email/samples";
import { SectionCard } from "@/components/layout/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  updateTemplateAction,
  previewTemplateAction,
  sendTestTemplateAction,
  resetTemplateAction,
  revertTemplateAction,
  type TemplateFields,
} from "@/lib/admin/email-actions";
import type { EmailTemplate, TemplateVariable, TemplateVersion } from "@/lib/admin/email-queries";

type FieldKey = keyof TemplateFields;
const TEXT_FIELDS: { key: FieldKey; label: string; area?: boolean }[] = [
  { key: "subject", label: "Subject" },
  { key: "preheader", label: "Preheader" },
  { key: "heading", label: "Heading" },
  { key: "body", label: "Body", area: true },
  { key: "callout", label: "Callout", area: true },
  { key: "cta_label", label: "CTA label" },
  { key: "cta_path", label: "CTA link" },
  { key: "footer_note", label: "Footer note" },
];

export function EmailEditor({
  template,
  variables,
  versions,
}: {
  template: EmailTemplate;
  variables: TemplateVariable[];
  versions: TemplateVersion[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState<TemplateFields>({
    subject: template.subject,
    preheader: template.preheader ?? "",
    heading: template.heading,
    body: template.body,
    callout: template.callout ?? "",
    cta_label: template.cta_label ?? "",
    cta_path: template.cta_path ?? "",
    footer_note: template.footer_note ?? "",
  });
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [tab, setTab] = useState<"html" | "text">("html");
  const [preview, setPreview] = useState<{ html: string; text: string; subject: string } | null>(null);
  const activeField = useRef<FieldKey>("body");
  const elements = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});

  const ctx = useMemo(() => sampleContext(variables.map((v) => v.name)), [variables]);

  const set = (k: FieldKey, v: string) => setF((p) => ({ ...p, [k]: v }));

  // Debounced live preview.
  useEffect(() => {
    const id = setTimeout(() => {
      previewTemplateAction(f, template.category, ctx).then((res) => {
        if (res.ok) setPreview({ html: res.html, text: res.text, subject: res.subject });
      });
    }, 500);
    return () => clearTimeout(id);
  }, [f, template.category, ctx]);

  function insertVariable(name: string) {
    const key = activeField.current;
    const el = elements.current[key];
    const token = `{{${name}}}`;
    if (el && typeof el.selectionStart === "number") {
      const start = el.selectionStart;
      const end = el.selectionEnd ?? start;
      const current = f[key] ?? "";
      set(key, current.slice(0, start) + token + current.slice(end));
    } else {
      set(key, `${f[key] ?? ""}${token}`);
    }
  }

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) { if (res.message) toast.success(res.message); router.refresh(); }
      else toast.error(res.error);
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {/* Fields */}
      <div className="space-y-4">
        <SectionCard title="Variables" description="Click to insert into the focused field.">
          <div className="flex flex-wrap gap-2">
            {variables.length ? variables.map((v) => (
              <button
                key={v.name}
                type="button"
                title={v.sample ? `e.g. ${v.sample}` : ctx[v.name]}
                onClick={() => insertVariable(v.name)}
                className="rounded-lg border border-border-strong bg-card px-2.5 py-1 font-mono text-xs text-indigo hover:border-violet"
              >
                {`{{${v.name}}}`}
              </button>
            )) : <p className="text-sm text-muted-foreground">This template has no variables.</p>}
          </div>
        </SectionCard>

        <SectionCard title="Content">
          <div className="space-y-4">
            {TEXT_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label>{field.label}</Label>
                {field.area ? (
                  <Textarea
                    ref={(el) => { elements.current[field.key] = el; }}
                    rows={field.key === "body" ? 6 : 2}
                    value={f[field.key] ?? ""}
                    onFocus={() => { activeField.current = field.key; }}
                    onChange={(e) => set(field.key, e.target.value)}
                  />
                ) : (
                  <Input
                    ref={(el) => { elements.current[field.key] = el; }}
                    value={f[field.key] ?? ""}
                    onFocus={() => { activeField.current = field.key; }}
                    onChange={(e) => set(field.key, e.target.value)}
                  />
                )}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Body supports **bold**, [links](https://…), and blank-line paragraphs.</p>
          </div>
        </SectionCard>

        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} onClick={() => run(() => updateTemplateAction(template.key, f))}>Save</Button>
          <Button variant="outline" disabled={pending} onClick={() => run(() => sendTestTemplateAction(f, template.category, ctx))}>
            <Send className="h-4 w-4" /> Send test to me
          </Button>
          <Button variant="ghost" disabled={pending} onClick={() => run(() => resetTemplateAction(template.key))}>
            <RotateCcw className="h-4 w-4" /> Reset to default
          </Button>
        </div>

        {versions.length ? (
          <SectionCard title="Revision history">
            <ul className="divide-y divide-border">
              {versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-muted-foreground">
                    v{v.version} · {v.changed_email ?? "system"} · {formatDateTime(v.created_at)}
                  </span>
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => revertTemplateAction(template.key, v.id))}>
                    Revert
                  </Button>
                </li>
              ))}
            </ul>
          </SectionCard>
        ) : null}
      </div>

      {/* Preview */}
      <div className="space-y-3 xl:sticky xl:top-6 xl:h-fit">
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1 rounded-lg border border-border p-0.5">
            <button className={`rounded px-2 py-1 text-sm ${tab === "html" ? "bg-secondary text-ink" : "text-muted-foreground"}`} onClick={() => setTab("html")}>HTML</button>
            <button className={`rounded px-2 py-1 text-sm ${tab === "text" ? "bg-secondary text-ink" : "text-muted-foreground"}`} onClick={() => setTab("text")}>Plain text</button>
          </div>
          {tab === "html" ? (
            <div className="flex gap-1 rounded-lg border border-border p-0.5">
              <button aria-label="Desktop" className={`rounded p-1.5 ${device === "desktop" ? "bg-secondary text-ink" : "text-muted-foreground"}`} onClick={() => setDevice("desktop")}><Monitor className="h-4 w-4" /></button>
              <button aria-label="Mobile" className={`rounded p-1.5 ${device === "mobile" ? "bg-secondary text-ink" : "text-muted-foreground"}`} onClick={() => setDevice("mobile")}><Smartphone className="h-4 w-4" /></button>
            </div>
          ) : null}
        </div>

        <p className="text-sm text-muted-foreground">Subject: <span className="font-semibold text-ink">{preview?.subject ?? f.subject}</span></p>

        {tab === "html" ? (
          <div className="overflow-hidden rounded-xl border border-border bg-secondary/40 p-3">
            <iframe
              title="Email preview"
              srcDoc={preview?.html ?? ""}
              className="mx-auto block h-[600px] w-full rounded-lg border border-border bg-white"
              style={{ maxWidth: device === "mobile" ? 380 : "100%" }}
            />
          </div>
        ) : (
          <pre className="whitespace-pre-wrap rounded-xl border border-border bg-card p-4 text-sm text-ink">{preview?.text ?? ""}</pre>
        )}
      </div>
    </div>
  );
}
