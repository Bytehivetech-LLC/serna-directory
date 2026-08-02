"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { submitInquiryAction } from "@/lib/listing/actions";
import { initialFormState } from "@/lib/forms";
import { executeRecaptcha } from "@/lib/security/recaptcha-client";
import { FormField } from "@/components/auth/form-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ContactForm({
  listingId,
  businessName,
}: {
  listingId: string;
  businessName: string;
}) {
  const [state, formAction, pending] = useActionState(
    submitInquiryAction,
    initialFormState,
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const token = await executeRecaptcha("inquiry");
    if (token) formData.set("recaptchaToken", token);
    formAction(formData);
  }

  if (state.ok && state.message) {
    return (
      <Alert>
        <CheckCircle2 className="h-4 w-4 text-good" />
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <input type="hidden" name="listingId" value={listingId} />

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Your name"
          name="name"
          autoComplete="name"
          required
          error={state.fieldErrors?.name}
        />
        <FormField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          error={state.fieldErrors?.email}
        />
      </div>

      <FormField
        label="Phone"
        name="phone"
        type="tel"
        autoComplete="tel"
        error={state.fieldErrors?.phone}
      />

      <div className="space-y-1.5">
        <Label htmlFor="message">
          Message <span className="text-violet">*</span>
        </Label>
        <Textarea
          id="message"
          name="message"
          required
          rows={5}
          placeholder={`Ask ${businessName} a question, or share what you're looking for…`}
          aria-invalid={state.fieldErrors?.message ? true : undefined}
        />
        {state.fieldErrors?.message ? (
          <p className="text-xs font-medium text-danger">
            {state.fieldErrors.message}
          </p>
        ) : null}
      </div>

      <SubmitButton pending={pending} size="lg">
        Send message
      </SubmitButton>
    </form>
  );
}
