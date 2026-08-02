"use client";

import { useActionState } from "react";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/forms";
import { FormField } from "./form-field";
import { SubmitButton } from "./submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordResetAction,
    initialFormState,
  );

  if (state.ok && state.message) {
    return (
      <Alert>
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors?.email}
        hint="We'll email a link to reset your password."
      />
      <SubmitButton pending={pending} className="w-full" size="lg">
        Send reset link
      </SubmitButton>
    </form>
  );
}
