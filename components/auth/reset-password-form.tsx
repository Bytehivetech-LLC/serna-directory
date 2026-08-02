"use client";

import { useActionState, useState } from "react";
import { updatePasswordAction } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/forms";
import { FormField } from "./form-field";
import { SubmitButton } from "./submit-button";
import { PasswordChecklist } from "./password-checklist";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(
    updatePasswordAction,
    initialFormState,
  );
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <FormField
        label="New password"
        name="password"
        error={state.fieldErrors?.password}
        required
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </FormField>
      <PasswordChecklist password={password} />

      <FormField
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirmPassword}
      />

      <SubmitButton pending={pending} className="w-full" size="lg">
        Update password
      </SubmitButton>
    </form>
  );
}
