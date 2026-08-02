"use server";

import { z } from "zod";
import { siteUrl } from "@/lib/site-url";
import { revalidatePath } from "next/cache";
import { requireAdmin, getSession } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";
import { sendTemplateEmail } from "@/lib/email/send";
import type { AdminActionResult } from "./users-actions";

const WEB = siteUrl();
const idSchema = z.string().uuid();

export async function markFulfilledAction(
  listingAddonId: string,
  notes: string,
): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(listingAddonId).success) return { ok: false, error: "Invalid item." };
  const admin = createAdminClient();
  const session = await getSession();

  const { data: row } = await admin
    .from("listing_addons")
    .select(
      "id, listing_id, addons(name), listings(business_name, slug, contact_name, contact_email)",
    )
    .eq("id", listingAddonId)
    .maybeSingle();
  if (!row) return { ok: false, error: "That item no longer exists." };

  const { error } = await admin
    .from("listing_addons")
    .update({
      status: "fulfilled",
      fulfilled_at: new Date().toISOString(),
      fulfilled_by: session?.user?.id ?? null,
      fulfilment_notes: notes.trim() || null,
    })
    .eq("id", listingAddonId);
  if (error) return { ok: false, error: "Couldn't mark that fulfilled." };

  const listing = (row as { listings?: { business_name?: string; slug?: string; contact_name?: string; contact_email?: string } }).listings;
  const addon = (row as { addons?: { name?: string } }).addons;
  if (listing?.contact_email) {
    await sendTemplateEmail("addon_fulfilled", {
      to: listing.contact_email,
      listingId: row.listing_id,
      context: {
        owner_name: listing.contact_name ?? "there",
        listing_name: listing.business_name ?? "your listing",
        addon_name: addon?.name ?? "your extra",
        note: notes.trim() || "",
        listing_path: `${WEB}/listing/${listing.slug ?? ""}`,
      },
    });
  }

  await logAudit({
    action: "addon.fulfil",
    entityType: "listing_addon",
    entityId: listingAddonId,
    meta: { notes: notes.trim() || undefined },
  });
  revalidatePath("/admin/fulfilment");
  return { ok: true, message: "Marked fulfilled and the owner was emailed." };
}

export async function addFulfilmentNoteAction(
  listingAddonId: string,
  note: string,
): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(listingAddonId).success) return { ok: false, error: "Invalid item." };
  if (!note.trim()) return { ok: false, error: "Write a note first." };
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("listing_addons")
    .select("fulfilment_notes")
    .eq("id", listingAddonId)
    .maybeSingle();
  if (!row) return { ok: false, error: "That item no longer exists." };

  const stamped = `${new Date().toISOString().slice(0, 10)}: ${note.trim()}`;
  const combined = row.fulfilment_notes ? `${row.fulfilment_notes}\n${stamped}` : stamped;

  const { error } = await admin
    .from("listing_addons")
    .update({ fulfilment_notes: combined })
    .eq("id", listingAddonId);
  if (error) return { ok: false, error: "Couldn't save that note." };

  await logAudit({
    action: "addon.note",
    entityType: "listing_addon",
    entityId: listingAddonId,
  });
  revalidatePath("/admin/fulfilment");
  return { ok: true, message: "Note added." };
}
