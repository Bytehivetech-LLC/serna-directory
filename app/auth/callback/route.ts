import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/forms";

/**
 * Handles magic-link, email-confirmation, and password-recovery redirects.
 * Exchanges the code (PKCE) or token_hash for a session, then routes the user:
 * onboarding-incomplete users land on the profile welcome; recovery links go to
 * /reset-password; everything else honours ?next=.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"), "/dashboard");

  const supabase = await createClient();

  let failed = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = Boolean(error);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    failed = Boolean(error);
  } else {
    return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
  }

  if (failed) {
    return NextResponse.redirect(new URL("/login?error=link_expired", request.url));
  }

  let destination = next;
  if (next !== "/reset-password") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_complete")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.onboarding_complete === false) {
        destination = "/dashboard/profile?welcome=1";
      }
    }
  }

  return NextResponse.redirect(new URL(destination, request.url));
}
