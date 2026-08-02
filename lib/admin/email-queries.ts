import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guards";
import type { Tables } from "@/types";

export type EmailTemplate = Tables<"email_templates">;

export type TemplateVariable = { name: string; sample?: string };

/** Variables can be stored as ["a","b"] or [{name,sample}] — normalise. */
export function parseVariables(value: unknown): TemplateVariable[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      if (typeof v === "string") return { name: v };
      if (v && typeof v === "object" && typeof (v as Record<string, unknown>).name === "string") {
        const o = v as Record<string, unknown>;
        return { name: o.name as string, sample: typeof o.sample === "string" ? o.sample : undefined };
      }
      return null;
    })
    .filter((v): v is TemplateVariable => Boolean(v));
}

export type TemplateListItem = {
  key: string;
  name: string;
  description: string | null;
  category: string;
  is_enabled: boolean;
  is_locked: boolean;
  updated_at: string;
  last_sent: string | null;
};

export async function getEmailTemplates(): Promise<TemplateListItem[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const [{ data: templates }, { data: sends }] = await Promise.all([
    admin
      .from("email_templates")
      .select("key, name, description, category, is_enabled, is_locked, updated_at")
      .order("category")
      .order("name"),
    admin
      .from("email_log")
      .select("template_key, created_at")
      .eq("status", "sent")
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);
  const lastSent = new Map<string, string>();
  for (const s of sends ?? []) {
    if (s.template_key && !lastSent.has(s.template_key)) lastSent.set(s.template_key, s.created_at);
  }
  return (templates ?? []).map((t) => ({ ...t, last_sent: lastSent.get(t.key) ?? null }));
}

export async function getEmailTemplate(key: string): Promise<EmailTemplate | null> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin.from("email_templates").select("*").eq("key", key).maybeSingle();
  return data;
}

export type TemplateVersion = {
  id: number;
  version: number;
  changed_by: string | null;
  changed_email: string | null;
  created_at: string;
  snapshot: unknown;
};

export async function getTemplateVersions(key: string): Promise<TemplateVersion[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("email_template_versions")
    .select("id, version, changed_by, created_at, snapshot")
    .eq("template_key", key)
    .order("version", { ascending: false })
    .limit(30);
  const rows = data ?? [];
  const ids = Array.from(new Set(rows.map((r) => r.changed_by).filter(Boolean))) as string[];
  const emails = new Map<string, string>();
  if (ids.length) {
    const { data: profiles } = await admin.from("profiles").select("id, email").in("id", ids);
    for (const p of profiles ?? []) emails.set(p.id, p.email);
  }
  return rows.map((r) => ({
    id: r.id,
    version: r.version,
    changed_by: r.changed_by,
    changed_email: r.changed_by ? emails.get(r.changed_by) ?? null : null,
    created_at: r.created_at,
    snapshot: r.snapshot,
  }));
}

/* ------------------------------------------------------------------- log --- */

export type EmailLogQuery = { template?: string; status?: string; recipient?: string; page?: number };

export async function getEmailLogPage(query: EmailLogQuery) {
  await requireAdmin();
  const admin = createAdminClient();
  const page = Math.max(1, query.page ?? 1);
  const pageSize = 50;
  const from = (page - 1) * pageSize;

  let q = admin
    .from("email_log")
    .select("id, template_key, to_email, subject, status, provider_id, error_message, created_at", { count: "exact" })
    .order("created_at", { ascending: false });
  if (query.template) q = q.eq("template_key", query.template);
  if (query.status) q = q.eq("status", query.status);
  if (query.recipient) q = q.ilike("to_email", `%${query.recipient}%`);

  const { data, count } = await q.range(from, from + pageSize - 1);
  return {
    rows: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  };
}
