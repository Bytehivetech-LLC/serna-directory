import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "listing-images";
const bodySchema = z.object({ listingId: z.string().uuid() });

/**
 * Issues a short-lived signed upload URL for an authenticated owner to push a
 * photo straight to Supabase Storage (browser → Supabase, never through here).
 * Verifies ownership AND the remaining image allowance (from listing_entitlements)
 * BEFORE signing. The path is `{listingId}/{uuid}.webp` — the storage policy reads
 * the folder, so the path itself is the permission.
 */
export async function POST(request: NextRequest) {
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

  const { data: listing } = await supabase
    .from("listings")
    .select("id, owner_id")
    .eq("id", parsed.data.listingId)
    .maybeSingle();
  if (!listing || listing.owner_id !== user.id) {
    return NextResponse.json({ error: "Not your listing." }, { status: 403 });
  }

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

  const uuid = crypto.randomUUID();
  const fullPath = `${listing.id}/${uuid}.webp`;
  const thumbPath = `${listing.id}/${uuid}_thumb.webp`;
  const [full, thumb] = await Promise.all([
    supabase.storage.from(BUCKET).createSignedUploadUrl(fullPath),
    supabase.storage.from(BUCKET).createSignedUploadUrl(thumbPath),
  ]);
  if (!full.data || !thumb.data) {
    return NextResponse.json({ error: "Could not sign upload." }, { status: 500 });
  }

  return NextResponse.json({
    fullPath,
    fullToken: full.data.token,
    thumbPath,
    thumbToken: thumb.data.token,
  });
}
