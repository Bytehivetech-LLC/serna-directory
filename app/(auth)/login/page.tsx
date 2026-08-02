import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Log in" };

const ERROR_MESSAGES: Record<string, string> = {
  link_expired: "That link has expired. Please request a new one.",
  invalid_link: "That link is invalid or has already been used.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;
  const registerHref = next
    ? `/register?next=${encodeURIComponent(next)}`
    : "/register";

  return (
    <AuthCard
      title="Log in"
      subtitle="Welcome back — sign in to manage your listings."
      footer={
        <>
          New here?{" "}
          <Link
            href={registerHref}
            className="font-semibold text-indigo hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      {errorMessage ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
      <LoginForm next={next} />
    </AuthCard>
  );
}
