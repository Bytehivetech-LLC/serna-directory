"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/forms";
import { FormField } from "@/components/auth/form-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export type ProfileDefaults = {
  fullName: string;
  phone: string;
  businessAddress: string;
};

export function ProfileForm({ defaults }: { defaults: ProfileDefaults }) {
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    initialFormState,
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.ok && state.message ? (
        <Alert>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <FormField
        label="Your name"
        name="fullName"
        defaultValue={defaults.fullName}
        autoComplete="name"
        required
        error={state.fieldErrors?.fullName}
      />
      <FormField
        label="Phone"
        name="phone"
        type="tel"
        defaultValue={defaults.phone}
        autoComplete="tel"
        error={state.fieldErrors?.phone}
      />
      <FormField
        label="Business address"
        name="businessAddress"
        defaultValue={defaults.businessAddress}
        autoComplete="street-address"
        error={state.fieldErrors?.businessAddress}
      />

      <SubmitButton pending={pending}>Save profile</SubmitButton>
    </form>
  );
}
