"use client";

import { scorePassword } from "@/lib/auth/password-strength";
import { cn } from "@/lib/utils/cn";

const BAR_COLORS: Record<number, string> = {
  0: "bg-border-strong",
  1: "bg-danger",
  2: "bg-warm-border",
  3: "bg-indigo",
  4: "bg-good",
};

export function PasswordStrengthMeter({ password }: { password: string }) {
  const { score, label, percent } = scorePassword(password);
  return (
    <div aria-live="polite">
      <div className="h-1.5 overflow-hidden rounded-full bg-border">
        <div
          className={cn("h-full rounded-full transition-all", BAR_COLORS[score])}
          style={{ width: `${percent}%` }}
        />
      </div>
      {label ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Password strength: <span className="font-semibold text-ink">{label}</span>
        </p>
      ) : null}
    </div>
  );
}
