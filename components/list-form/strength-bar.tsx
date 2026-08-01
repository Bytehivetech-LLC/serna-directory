"use client";

import { SubmitButton } from "@/components/auth/submit-button";

export function StrengthBar({
  percent,
  message,
  canPublish,
  pending,
  submitLabel,
  onPublish,
}: {
  percent: number;
  message: React.ReactNode;
  canPublish: boolean;
  pending: boolean;
  submitLabel: string;
  onPublish: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-20 -mx-6 border-t border-border bg-card/95 px-6 pb-5 pt-3.5 backdrop-blur">
      <div className="mx-auto max-w-[720px]">
        <div className="h-2 overflow-hidden rounded-full bg-[#edecf7]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo to-violet transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-4">
          <p className="text-[13px] text-muted-foreground">{message}</p>
          <SubmitButton
            type="button"
            onClick={onPublish}
            disabled={!canPublish || pending}
            pending={pending}
          >
            {submitLabel}
          </SubmitButton>
        </div>
      </div>
    </div>
  );
}
