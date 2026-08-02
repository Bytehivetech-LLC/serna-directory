import "server-only";
import { z } from "zod";
import { notFound } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import type { Listing } from "@/types";

/**
 * Load a listing the current user OWNS, or 404. RLS lets anyone read a PUBLISHED
 * listing, so the explicit owner_id check is what stops a second user from
 * opening someone else's edit/inquiries URL. Every dashboard listing page and
 * action must go through this — never trust the id in the URL.
 */
export async function requireOwnedListing(
  id: string,
): Promise<{ user: User; listing: Listing }> {
  if (!z.string().uuid().safeParse(id).success) notFound();

  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data || data.owner_id !== user.id || data.deleted_at) notFound();
  return { user, listing: data };
}
