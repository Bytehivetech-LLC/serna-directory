"use client";

import type { FormField } from "@/lib/list-form/types";
import { cn } from "@/lib/utils/cn";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function DynamicField({
  field,
  label,
  value,
  onChange,
}: {
  field: FormField;
  /** Effective label (may be category-overridden, e.g. "Tuition"). */
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `f-${field.key}`;
  const describedBy = field.helpText ? `${id}-help` : undefined;

  const labelEl = (
    <Label htmlFor={id}>
      {label}
      {field.isRequired ? <span className="text-violet"> *</span> : null}
    </Label>
  );

  const help = field.helpText ? (
    <p id={`${id}-help`} className="text-xs text-muted-foreground">
      {field.helpText}
    </p>
  ) : null;

  if (field.type === "textarea") {
    const len = value.length;
    return (
      <div className="space-y-1.5">
        {labelEl}
        {help}
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? undefined}
          rows={6}
          maxLength={field.maxLength ?? undefined}
          aria-describedby={describedBy}
        />
        <p
          className={cn(
            "text-right text-xs text-faint",
            len >= 400 && "font-semibold text-good",
          )}
        >
          {len === 0
            ? "Aim for a few full paragraphs"
            : len < 400
              ? `${len} characters — ${400 - len} more for full points`
              : `${len} characters — great detail ✓`}
        </p>
      </div>
    );
  }

  if (field.type === "radio") {
    return (
      <div className="space-y-2">
        {labelEl}
        {help}
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
          {field.options.map((opt) => {
            const active = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange(opt.value)}
                className={cn(
                  "rounded-full border px-5 py-2 text-sm font-semibold transition-colors",
                  active
                    ? "border-indigo bg-indigo text-white"
                    : "border-border-strong bg-card text-muted-foreground hover:border-violet",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className="space-y-1.5">
        {labelEl}
        {help}
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={id}>
            <SelectValue placeholder={field.placeholder ?? "Choose one"} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // text / url / email / tel
  return (
    <div className="space-y-1.5">
      {labelEl}
      {help}
      <Input
        id={id}
        type={field.type === "text" ? "text" : field.type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder ?? undefined}
        maxLength={field.maxLength ?? undefined}
        aria-describedby={describedBy}
      />
    </div>
  );
}
