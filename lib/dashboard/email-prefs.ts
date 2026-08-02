"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

/** Non-essential mail an owner may opt out of. Receipts, enquiries, and account
 * security mail are never in this list. */
export const OPTIONAL_EMAIL_KEYS = [
  "listing_expiring",
  "listing_expired",
  "addon_expiring",
  "welcome",
  "tips",
] as const;

export type EmailPrefsResult = { ok: true } | { ok: false; error: string };

export async function updateEmailPrefsAction(optOut: string[]): Promise<EmailPrefsResult> {
  const user = await requireUser();
  const parsed = z.array(z.enum(OPTIONAL_EMAIL_KEYS)).max(20).safeParse(optOut);
  if (!parsed.success) return { ok: false, error: "Invalid preferences." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ email_opt_out: Array.from(new Set(parsed.data)) })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't save your preferences." };

  revalidatePath("/dashboard/profile");
  return { ok: true };
}
