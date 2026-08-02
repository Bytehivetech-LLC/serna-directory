"use client";

import { useActionState, useState } from "react";
import { signUpAction } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/forms";
import { executeRecaptcha } from "@/lib/security/recaptcha-client";
import { FormField } from "./form-field";
import { SubmitButton } from "./submit-button";
import { PasswordChecklist } from "./password-checklist";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function RegisterForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(
    signUpAction,
    initialFormState,
  );
  const [password, setPassword] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const token = await executeRecaptcha("register");
    if (token) formData.set("recaptchaToken", token);
    formAction(formData);
  }

  if (state.ok && state.message) {
    return (
      <Alert>
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
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
        label="Your name"
        name="fullName"
        autoComplete="name"
        required
        error={state.fieldErrors?.fullName}
      />
      <FormField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors?.email}
      />

      <FormField
        label="Password"
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
          aria-invalid={state.fieldErrors?.password ? true : undefined}
        />
      </FormField>
      <PasswordChecklist password={password} />

      <div className="flex items-start gap-2.5 pt-1">
        <Checkbox id="acceptTerms" name="acceptTerms" className="mt-0.5" />
        <div>
          <Label htmlFor="acceptTerms" className="font-normal leading-snug">
            I agree to the Terms of Service and Privacy Policy.
          </Label>
          {state.fieldErrors?.acceptTerms ? (
            <p className="mt-1 text-xs font-medium text-danger">
              {state.fieldErrors.acceptTerms}
            </p>
          ) : null}
        </div>
      </div>

      <SubmitButton pending={pending} className="w-full" size="lg">
        Create account
      </SubmitButton>
    </form>
  );
}
