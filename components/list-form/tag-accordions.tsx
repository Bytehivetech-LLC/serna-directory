"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { FormTagGroup } from "@/lib/list-form/types";
import { cn } from "@/lib/utils/cn";

export function TagAccordions({
  groups,
  selected,
  onToggle,
}: {
  groups: FormTagGroup[];
  selected: Set<string>;
  onToggle: (slug: string) => void;
}) {
  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <TagAccordion
          key={group.id}
          group={group}
          selected={selected}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

function TagAccordion({
  group,
  selected,
  onToggle,
}: {
  group: FormTagGroup;
  selected: Set<string>;
  onToggle: (slug: string) => void;
}) {
  const count = group.tags.filter((t) => selected.has(t.slug)).length;
  const [open, setOpen] = useState(count > 0);

  return (
    <div className="overflow-hidden rounded-xl border border-border-strong">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-ink"
      >
        <span>
          {group.name}
          {count > 0 ? (
            <span className="ml-2 text-xs font-semibold text-violet">
              · {count} selected
            </span>
          ) : null}
        </span>
        <ChevronRight
          className={cn(
            "h-4 w-4 text-faint transition-transform",
            open && "rotate-90",
          )}
        />
      </button>
      {open ? (
        <div className="flex flex-wrap gap-2 px-4 pb-4">
          {group.tags.map((tag) => {
            const active = selected.has(tag.slug);
            return (
              <button
                key={tag.id}
                type="button"
                aria-pressed={active}
                onClick={() => onToggle(tag.slug)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                  active
                    ? "border-indigo bg-indigo text-white"
                    : "border-border-strong bg-card text-muted-foreground hover:border-violet",
                )}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
