"use client";

import { Check, Circle } from "lucide-react";
import { PASSWORD_RULES } from "@/lib/validation/schemas";
import { cn } from "@/lib/utils/cn";

/**
 * A live requirements checklist — each rule ticks as it's met. Not a coloured
 * strength bar: a bar tells you "weak" without telling you what to do. Announced
 * to screen readers via aria-live.
 */
export function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul className="mt-2 space-y-1" aria-live="polite">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li key={rule.label} className="flex items-center gap-2 text-xs">
            {met ? (
              <Check className="h-3.5 w-3.5 text-good" aria-hidden />
            ) : (
              <Circle className="h-3.5 w-3.5 text-faint" aria-hidden />
            )}
            <span className={cn(met ? "text-good" : "text-muted-foreground")}>
              {rule.label}
            </span>
            <span className="sr-only">{met ? "met" : "not met"}</span>
          </li>
        );
      })}
    </ul>
  );
}
