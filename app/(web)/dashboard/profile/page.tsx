import type { Metadata } from "next";
import { requireUser, getProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/layout/page-heading";
import { SectionCard } from "@/components/layout/section-card";
import { EmailPreferences } from "@/components/dashboard/email-preferences";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { AvatarUpload } from "@/components/dashboard/avatar-upload";
import { ChangePasswordForm } from "@/components/dashboard/change-password-form";
import { MfaSection } from "@/components/dashboard/mfa-section";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { welcome } = await searchParams;
  const user = await requireUser();
  const profile = await getProfile();

  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verifiedTotp = factors?.totp?.find((f) => f.status === "verified");

  const defaults = {
    fullName:
      profile?.full_name ??
      (typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : "") ??
      "",
    phone: profile?.phone ?? "",
    businessAddress: profile?.business_address ?? "",
  };

  return (
    <div className="space-y-6">
      <PageHeading
        title="Profile"
        lede="Your account details and security settings."
      />

      {welcome ? (
        <Alert>
          <AlertDescription>
            Welcome to Serna! Add your details below to finish setting up your
            account.
          </AlertDescription>
        </Alert>
      ) : null}

      <SectionCard
        title="Profile picture"
        description="Shown in your dashboard and account menu — never on your public listings."
      >
        <AvatarUpload initialUrl={profile?.avatar_url ?? null} />
      </SectionCard>

      <SectionCard
        title="Your details"
        description={`Signed in as ${user.email}`}
      >
        <ProfileForm defaults={defaults} />
      </SectionCard>

      <SectionCard
        title="Password"
        description="Choose a new password for your account."
      >
        <ChangePasswordForm />
      </SectionCard>

      <SectionCard
        title="Two-factor authentication"
        description="Protect your account with an authenticator app."
      >
        <MfaSection
          initialEnrolled={Boolean(verifiedTotp)}
          initialFactorId={verifiedTotp?.id}
        />
      </SectionCard>

      <SectionCard title="Email preferences" description="Choose which optional emails you receive.">
        <EmailPreferences
          initialOptOut={Array.isArray(profile?.email_opt_out) ? (profile!.email_opt_out as string[]) : []}
        />
      </SectionCard>
    </div>
  );
}
