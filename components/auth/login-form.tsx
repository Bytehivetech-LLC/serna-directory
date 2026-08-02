"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInAction } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/forms";
import { executeRecaptcha } from "@/lib/security/recaptcha-client";
import { FormField } from "./form-field";
import { SubmitButton } from "./submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(
    signInAction,
    initialFormState,
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const token = await executeRecaptcha("login");
    if (token) formData.set("recaptchaToken", token);
    formAction(formData);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <FormField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors?.email}
      />

      <div className="space-y-1.5">
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={state.fieldErrors?.password}
        />
        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-xs font-semibold text-indigo hover:underline"
          >
            Forgot password?
          </Link>
        </div>
      </div>

      <SubmitButton pending={pending} className="w-full" size="lg">
        Log in
      </SubmitButton>
    </form>
  );
}
