import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStaff } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit/log";
import { checkRateLimit } from "@/lib/utils/rate-limit";

const BUCKET = "listing-images";
const bodySchema = z.object({ listingId: z.string().uuid() });

/**
 * Issues a short-lived signed upload URL to push a photo straight to Supabase
 * Storage (browser → Supabase, never through here).
 *
 * Access: the listing's OWNER, or any staff member (admin/moderator) editing on
 * a customer's behalf. Staff signs with the SERVICE-ROLE client because the
 * caller's anon-key session can't write outside the owner's folder, and staff
 * skip the customer's package image cap (logged to audit_log instead). The path
 * is `{listingId}/{uuid}.webp` — the storage policy reads the folder, so the path
 * itself is the permission.
 */
export async function POST(request: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    // Cap signed-URL minting per user so a compromised session can't flood storage.
    const limit = await checkRateLimit(`upload-url:user:${user.id}`, 120, 60 * 60);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many uploads — try again later." }, { status: 429 });
    }

    const { data: listing } = await supabase
      .from("listings")
      .select("id, owner_id")
      .eq("id", parsed.data.listingId)
      .maybeSingle();
    if (!listing) {
      return NextResponse.json({ error: "That listing no longer exists." }, { status: 404 });
    }

    const owns = listing.owner_id === user.id;
    const staff = owns ? false : await isStaff();
    if (!owns && !staff) {
      return NextResponse.json({ error: "You don't have access to this listing." }, { status: 403 });
    }

    // Entitlement cap applies to the OWNER only — staff adding a photo on a
    // customer's behalf isn't blocked by that customer's package limit.
    if (owns) {
      const { data: ent } = await supabase.rpc("listing_entitlements", {
        p_listing_id: listing.id,
      });
      const entRow = Array.isArray(ent) ? ent[0] : ent;
      const max = entRow?.max_images ?? 8;
      const { count } = await supabase
        .from("listing_images")
        .select("id", { count: "exact", head: true })
        .eq("listing_id", listing.id);
      if ((count ?? 0) >= max) {
        return NextResponse.json(
          { error: `You've reached your ${max}-photo limit.` },
          { status: 409 },
        );
      }
    } else {
      await logAudit({
        action: "listing.admin_upload",
        entityType: "listing",
        entityId: listing.id,
        meta: { on_behalf_of: listing.owner_id },
      });
    }

    // Staff-not-owner must sign with the service role (anon session can't write
    // outside the owner's folder); the owner signs with their own session.
    const signer = staff && !owns ? createAdminClient() : supabase;
    const uuid = crypto.randomUUID();
    const fullPath = `${listing.id}/${uuid}.webp`;
    const thumbPath = `${listing.id}/${uuid}_thumb.webp`;
    const [full, thumb] = await Promise.all([
      signer.storage.from(BUCKET).createSignedUploadUrl(fullPath),
      signer.storage.from(BUCKET).createSignedUploadUrl(thumbPath),
    ]);
    if (!full.data || !thumb.data) {
      console.error("[upload] sign failed", full.error?.message, thumb.error?.message);
      return NextResponse.json({ error: "Couldn't reach storage. Please try again." }, { status: 502 });
    }

    return NextResponse.json({
      fullPath,
      fullToken: full.data.token,
      thumbPath,
      thumbToken: thumb.data.token,
    });
  } catch (e) {
    console.error("[upload] threw:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't prepare the upload. Please try again." }, { status: 500 });
  }
}
