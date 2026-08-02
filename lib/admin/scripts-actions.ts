"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin, getSession } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";
import { guidedProvider, guidedSnippet } from "@/lib/scripts/providers";
import { describeDbError } from "./db-error";
import type { AdminActionResult } from "./users-actions";

// Same patterns the DB trigger enforces — reject early with a friendly message.
const FORBIDDEN = [
  /document\s*\.\s*cookie/i,
  /\beval\s*\(/i,
  /new\s+Function\s*\(/i,
  /\.\s*(localStorage|sessionStorage)\b/i,
];

function dangerous(code: string): boolean {
  return FORBIDDEN.some((re) => re.test(code));
}

/** Recompute the union of active scripts' external hosts into a setting the CSP
 * builder reads, so adding one tag doesn't force the whole policy open. */
async function refreshScriptHosts(admin: ReturnType<typeof createAdminClient>) {
  const { data } = await admin.from("site_scripts").select("external_hosts").eq("is_active", true);
  const hosts = Array.from(new Set((data ?? []).flatMap((r) => (Array.isArray(r.external_hosts) ? r.external_hosts : []))));
  await admin.from("site_settings").upsert({ key: "script_hosts", value: hosts as never });
}

async function afterChange(admin: ReturnType<typeof createAdminClient>) {
  await refreshScriptHosts(admin);
  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
}

/* --------------------------------------------------------------- guided --- */

export async function createGuidedScriptAction(kind: string, id: string): Promise<AdminActionResult> {
  await requireAdmin();
  const provider = guidedProvider(kind);
  if (!provider) return { ok: false, error: "Unknown provider." };
  const cleanId = id.trim();
  if (!provider.pattern.test(cleanId)) {
    return { ok: false, error: `That doesn't look like a ${provider.label} ID (expected ${provider.placeholder}).` };
  }
  const code = guidedSnippet(kind, cleanId);
  if (!code) return { ok: false, error: "Couldn't generate the snippet." };

  const admin = createAdminClient();
  const session = await getSession();
  const { data: max } = await admin.from("site_scripts").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();

  const { error } = await admin.from("site_scripts").insert({
    name: provider.label,
    kind,
    config: { id: cleanId },
    code,
    placement: provider.placement,
    applies_to: "all",
    external_hosts: provider.hosts,
    consent_group: provider.consentGroup,
    is_active: false,
    sort_order: (max?.sort_order ?? -1) + 1,
    created_by: session?.user?.id ?? null,
    updated_by: session?.user?.id ?? null,
  });
  if (error) return { ok: false, error: "Couldn't add that tag." };

  await logAudit({ action: "script.create_guided", entityType: "site_script", meta: { kind } });
  await afterChange(admin);
  return { ok: true, message: `${provider.label} added (inactive — activate when you're ready).` };
}

/* --------------------------------------------------------------- custom --- */

const customSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(20000),
  placement: z.enum(["head", "body_start", "body_end"]),
  applies_to: z.string().trim().max(60).default("all"),
  consent_group: z.enum(["essential", "analytics", "marketing"]),
  external_hosts: z.array(z.string().trim().max(200)).max(30).default([]),
  notes: z.string().trim().max(1000).optional().nullable(),
});
export type CustomScriptInput = z.infer<typeof customSchema>;

export async function createCustomScriptAction(input: unknown): Promise<AdminActionResult> {
  await requireAdmin();
  const parsed = customSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;
  if (dangerous(d.code)) {
    return { ok: false, error: "That code accesses cookies/storage or evaluates dynamic code, which isn't allowed." };
  }
  const admin = createAdminClient();
  const session = await getSession();
  const { data: max } = await admin.from("site_scripts").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();

  const { error } = await admin.from("site_scripts").insert({
    name: d.name,
    kind: "custom",
    config: {},
    code: d.code,
    placement: d.placement,
    applies_to: d.applies_to,
    external_hosts: d.external_hosts,
    consent_group: d.consent_group,
    notes: d.notes ?? null,
    is_active: false,
    sort_order: (max?.sort_order ?? -1) + 1,
    created_by: session?.user?.id ?? null,
    updated_by: session?.user?.id ?? null,
  });
  if (error) {
    // The validate_site_script trigger raises a descriptive message — surface it.
    return { ok: false, error: describeDbError(error, "Couldn't save the script.", "createCustomScript") };
  }

  await logAudit({ action: "script.create_custom", entityType: "site_script", meta: { name: d.name } });
  await afterChange(admin);
  return { ok: true, message: "Saved. Not yet active — turn it on when you're ready." };
}

export async function updateCustomScriptAction(id: string, input: unknown): Promise<AdminActionResult> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Invalid script." };
  const parsed = customSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;
  if (dangerous(d.code)) return { ok: false, error: "That code isn't allowed (cookies/storage/eval)." };
  const admin = createAdminClient();
  const session = await getSession();
  const { error } = await admin.from("site_scripts").update({
    name: d.name, code: d.code, placement: d.placement, applies_to: d.applies_to,
    external_hosts: d.external_hosts, consent_group: d.consent_group, notes: d.notes ?? null,
    updated_by: session?.user?.id ?? null,
  }).eq("id", id);
  if (error) return { ok: false, error: describeDbError(error, "Couldn't save.", "updateCustomScript") };
  await logAudit({ action: "script.update", entityType: "site_script", entityId: id });
  await afterChange(admin);
  return { ok: true, message: "Saved." };
}

export async function toggleScriptAction(id: string, active: boolean): Promise<AdminActionResult> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Invalid script." };
  const admin = createAdminClient();
  const { error } = await admin.from("site_scripts").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, error: describeDbError(error, "Couldn't update that.", "toggleScript") };
  await logAudit({ action: "script.toggle", entityType: "site_script", entityId: id, meta: { active } });
  await afterChange(admin);
  return { ok: true, message: active ? "Script activated." : "Script deactivated." };
}

export async function deleteScriptAction(id: string): Promise<AdminActionResult> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Invalid script." };
  const admin = createAdminClient();
  const { error } = await admin.from("site_scripts").delete().eq("id", id);
  if (error) return { ok: false, error: describeDbError(error, "Couldn't delete that.", "deleteScript") };
  await logAudit({ action: "script.delete", entityType: "site_script", entityId: id });
  await afterChange(admin);
  return { ok: true, message: "Script deleted." };
}
