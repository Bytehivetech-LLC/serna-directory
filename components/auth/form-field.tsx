"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

export type FormFieldProps = React.ComponentProps<"input"> & {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  /** Render a custom control (e.g. a password field with a meter) instead of Input. */
  children?: React.ReactNode;
};

/** Labeled input with an inline error message (never a top-of-form summary). */
export function FormField({
  label,
  name,
  error,
  hint,
  required,
  className,
  children,
  ...inputProps
}: FormFieldProps) {
  const errorId = error ? `${name}-error` : undefined;
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={name}>
        {label}
        {required ? <span className="text-violet"> *</span> : null}
      </Label>
      {children ?? (
        <Input
          id={name}
          name={name}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={cn(errorId, hintId) || undefined}
          {...inputProps}
        />
      )}
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
