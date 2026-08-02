"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin, getSession } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";
import { renderShape } from "@/lib/email/render";
import { sendEmail } from "@/lib/email/sendgrid";
import { FALLBACK_TEMPLATES } from "@/lib/email/fallbacks";
import { parseVariables } from "./email-queries";
import type { AdminActionResult } from "./users-actions";

const GLOBAL_VARS = ["site_name", "support_email", "site_url"];

const fieldsSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required.").max(200),
  preheader: z.string().trim().max(200).optional().nullable(),
  heading: z.string().trim().min(1, "Heading is required.").max(200),
  body: z.string().trim().min(1, "Body is required.").max(5000),
  callout: z.string().trim().max(1000).optional().nullable(),
  cta_label: z.string().trim().max(80).optional().nullable(),
  cta_path: z.string().trim().max(400).optional().nullable(),
  footer_note: z.string().trim().max(600).optional().nullable(),
});
export type TemplateFields = z.infer<typeof fieldsSchema>;

function toShape(f: TemplateFields, category: string) {
  return {
    category,
    subject: f.subject,
    preheader: f.preheader ?? undefined,
    heading: f.heading,
    body: f.body,
    callout: f.callout ?? undefined,
    cta_label: f.cta_label ?? undefined,
    cta_path: f.cta_path ?? undefined,
    footer_note: f.footer_note ?? undefined,
  };
}

function usedVariables(fields: TemplateFields): string[] {
  const text = [fields.subject, fields.preheader, fields.heading, fields.body, fields.callout, fields.cta_label, fields.cta_path, fields.footer_note]
    .filter(Boolean)
    .join(" ");
  const found = new Set<string>();
  for (const m of text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) found.add(m[1]);
  return [...found];
}

async function snapshot(admin: ReturnType<typeof createAdminClient>, key: string) {
  const { data: current } = await admin.from("email_templates").select("*").eq("key", key).maybeSingle();
  if (!current) return null;
  const session = await getSession();
  await admin.from("email_template_versions").insert({
    template_key: key,
    version: current.version,
    snapshot: current as never,
    changed_by: session?.user?.id ?? null,
  });
  return current;
}

export async function updateTemplateAction(key: string, input: unknown): Promise<AdminActionResult> {
  await requireAdmin();
  const parsed = fieldsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const f = parsed.data;
  const admin = createAdminClient();

  const { data: row } = await admin.from("email_templates").select("variables, version").eq("key", key).maybeSingle();
  if (!row) return { ok: false, error: "That template no longer exists." };

  const allowed = new Set([...parseVariables(row.variables).map((v) => v.name), ...GLOBAL_VARS]);
  const bad = usedVariables(f).find((v) => !allowed.has(v));
  if (bad) {
    return { ok: false, error: `Unknown variable {{${bad}}}. Remove it or use one from this template's variable list.` };
  }

  await snapshot(admin, key);
  const session = await getSession();
  const { error } = await admin
    .from("email_templates")
    .update({
      subject: f.subject,
      preheader: f.preheader ?? null,
      heading: f.heading,
      body: f.body,
      callout: f.callout ?? null,
      cta_label: f.cta_label ?? null,
      cta_path: f.cta_path ?? null,
      footer_note: f.footer_note ?? null,
      version: (row.version ?? 0) + 1,
      updated_by: session?.user?.id ?? null,
    })
    .eq("key", key);
  if (error) return { ok: false, error: "Couldn't save the template." };

  await logAudit({ action: "email_template.update", entityType: "email_template", entityId: key });
  revalidatePath(`/admin/emails/${key}`);
  revalidatePath("/admin/emails");
  return { ok: true, message: "Template saved." };
}

export async function toggleTemplateAction(key: string, enabled: boolean): Promise<AdminActionResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: row } = await admin.from("email_templates").select("is_locked").eq("key", key).maybeSingle();
  if (!row) return { ok: false, error: "That template no longer exists." };
  if (row.is_locked) return { ok: false, error: "This email is locked on — it carries essential account information." };
  const { error } = await admin.from("email_templates").update({ is_enabled: enabled }).eq("key", key);
  if (error) return { ok: false, error: "Couldn't update that." };
  await logAudit({ action: "email_template.toggle", entityType: "email_template", entityId: key, meta: { enabled } });
  revalidatePath("/admin/emails");
  return { ok: true, message: enabled ? "Email enabled." : "Email disabled." };
}

export async function revertTemplateAction(key: string, versionId: number): Promise<AdminActionResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: ver } = await admin.from("email_template_versions").select("snapshot").eq("id", versionId).eq("template_key", key).maybeSingle();
  const snap = ver?.snapshot as Record<string, unknown> | undefined;
  if (!snap) return { ok: false, error: "That version no longer exists." };

  const current = await snapshot(admin, key);
  if (!current) return { ok: false, error: "That template no longer exists." };
  const session = await getSession();
  const { error } = await admin
    .from("email_templates")
    .update({
      subject: String(snap.subject ?? current.subject),
      preheader: (snap.preheader as string) ?? null,
      heading: String(snap.heading ?? current.heading),
      body: String(snap.body ?? current.body),
      callout: (snap.callout as string) ?? null,
      cta_label: (snap.cta_label as string) ?? null,
      cta_path: (snap.cta_path as string) ?? null,
      footer_note: (snap.footer_note as string) ?? null,
      version: (current.version ?? 0) + 1,
      updated_by: session?.user?.id ?? null,
    })
    .eq("key", key);
  if (error) return { ok: false, error: "Couldn't revert." };
  await logAudit({ action: "email_template.revert", entityType: "email_template", entityId: key, meta: { versionId } });
  revalidatePath(`/admin/emails/${key}`);
  return { ok: true, message: "Reverted." };
}

export async function resetTemplateAction(key: string): Promise<AdminActionResult> {
  await requireAdmin();
  const fallback = FALLBACK_TEMPLATES[key];
  if (!fallback) return { ok: false, error: "No seeded default exists for this template." };
  const admin = createAdminClient();
  const current = await snapshot(admin, key);
  if (!current) return { ok: false, error: "That template no longer exists." };
  const session = await getSession();
  const { error } = await admin
    .from("email_templates")
    .update({
      subject: fallback.subject,
      preheader: fallback.preheader ?? null,
      heading: fallback.heading,
      body: fallback.body,
      callout: fallback.callout ?? null,
      cta_label: fallback.cta_label ?? null,
      cta_path: fallback.cta_path ?? null,
      footer_note: fallback.footer_note ?? null,
      version: (current.version ?? 0) + 1,
      updated_by: session?.user?.id ?? null,
    })
    .eq("key", key);
  if (error) return { ok: false, error: "Couldn't reset." };
  await logAudit({ action: "email_template.reset", entityType: "email_template", entityId: key });
  revalidatePath(`/admin/emails/${key}`);
  return { ok: true, message: "Reset to the seeded default." };
}

export async function previewTemplateAction(
  input: unknown,
  category: string,
  context: Record<string, string>,
): Promise<{ ok: true; subject: string; html: string; text: string } | { ok: false; error: string }> {
  await requireAdmin();
  const parsed = fieldsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const rendered = await renderShape(toShape(parsed.data, category), context);
  return { ok: true, ...rendered };
}

export async function sendTestTemplateAction(
  input: unknown,
  category: string,
  context: Record<string, string>,
): Promise<AdminActionResult> {
  await requireAdmin();
  const parsed = fieldsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const session = await getSession();
  const to = session?.user?.email;
  if (!to) return { ok: false, error: "Your account has no email." };

  const rendered = await renderShape(toShape(parsed.data, category), context);
  const result = await sendEmail({ to, subject: `[test] ${rendered.subject}`, html: rendered.html, text: rendered.text });

  const admin = createAdminClient();
  await admin.from("email_log").insert({
    template_key: "test",
    to_email: to,
    subject: rendered.subject,
    status: result.status,
    provider_id: result.providerId ?? null,
    error_message: result.error ?? null,
    user_id: session?.user?.id ?? null,
  });

  if (result.status === "failed") return { ok: false, error: "Couldn't send — check the SendGrid key." };
  return { ok: true, message: result.status === "skipped" ? "Mail isn't configured here." : `Test sent to ${to}.` };
}
