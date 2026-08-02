"use client";

import { useId, useRef, useState } from "react";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

const DEFAULT_ACCEPT = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2MB

function human(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes % (1024 * 1024) === 0 ? 0 : 1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

function extList(accept: string[]): string {
  return accept
    .map((a) => a.split("/")[1]?.replace("svg+xml", "svg").replace("jpeg", "jpg")?.toUpperCase())
    .filter(Boolean)
    .join(", ");
}

/**
 * One image upload control for the whole admin + dashboard: dashed drop zone →
 * progress → thumbnail preview with Replace / Remove. It NEVER shows the raw
 * filename (that's noise and leaks the admin's local paths). The actual upload
 * is delegated to `onUpload` so each call site keeps its own signing/persist
 * flow; this component owns only the UX, validation, and error surfacing.
 *
 * `round` gives the avatar variant (Session 5). `withAlt` shows an alt-text
 * field where alt matters (listing images, add-on cards).
 */
export function ImageUploadField({
  value,
  onUpload,
  onRemove,
  accept = DEFAULT_ACCEPT,
  maxBytes = DEFAULT_MAX_BYTES,
  label,
  hint,
  round = false,
  withAlt = false,
  alt = "",
  onAltChange,
  disabled = false,
}: {
  value?: string | null;
  onUpload: (file: File) => Promise<UploadResult>;
  onRemove?: () => Promise<UploadResult | void> | void;
  accept?: string[];
  maxBytes?: number;
  label: string;
  hint?: string;
  round?: boolean;
  withAlt?: boolean;
  alt?: string;
  onAltChange?: (value: string) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const altId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(value ?? null);

  function validate(file: File): string | null {
    if (accept.length && !accept.includes(file.type)) {
      return `That's a ${file.type.split("/")[1]?.toUpperCase() || "unsupported"} file. Use ${extList(accept)}.`;
    }
    if (file.size > maxBytes) {
      return `That file is ${human(file.size)}, the limit is ${human(maxBytes)}.`;
    }
    return null;
  }

  async function handleFile(file: File) {
    setError(null);
    const problem = validate(file);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      const res = await onUpload(file);
      if (res.ok) setCurrent(res.url);
      else setError(res.error);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setError(null);
    setBusy(true);
    try {
      const res = await onRemove?.();
      if (res && res.ok === false) {
        setError(res.error);
        return;
      }
      setCurrent(null);
    } finally {
      setBusy(false);
    }
  }

  const previewBox = cn(
    "relative grid place-items-center overflow-hidden border border-border bg-secondary",
    round ? "h-20 w-20 rounded-full" : "h-20 w-28 rounded-lg",
  );

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>

      {current ? (
        <div className="flex items-center gap-4">
          <div className={previewBox}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current} alt={alt || "Uploaded image preview"} className="h-full w-full object-contain" />
            {busy ? (
              <div className="absolute inset-0 grid place-items-center bg-card/70">
                <Loader2 className="h-4 w-4 animate-spin text-violet" />
              </div>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || busy}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="h-4 w-4" /> Replace
              </Button>
              {onRemove ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled || busy}
                  onClick={handleRemove}
                  className="text-danger hover:bg-danger-soft hover:text-danger"
                >
                  <X className="h-4 w-4" /> Remove
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1.5 border border-dashed px-4 py-6 text-center transition-colors",
            round ? "h-28 w-28 rounded-full" : "rounded-xl",
            dragOver ? "border-violet bg-violet-soft" : "border-border-strong bg-card hover:bg-secondary/50",
            (disabled || busy) && "pointer-events-none opacity-60",
          )}
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin text-violet" />
          ) : (
            <ImageIcon className="h-5 w-5 text-faint" aria-hidden />
          )}
          {!round ? (
            <>
              <span className="text-sm font-semibold text-ink">
                Drag an image here or browse
              </span>
              <span className="text-xs text-muted-foreground">
                {extList(accept)} · up to {human(maxBytes)}
              </span>
            </>
          ) : (
            <span className="text-[11px] font-semibold text-muted-foreground">Upload</span>
          )}
        </label>
      )}

      {/* Indeterminate progress while the upload is in flight. */}
      {busy ? (
        <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full w-1/3 animate-[imgupload_1.1s_ease-in-out_infinite] rounded-full bg-violet" />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}

      {withAlt ? (
        <div className="space-y-1 pt-1">
          <Label htmlFor={altId} className="text-xs">
            Alt text (for screen readers)
          </Label>
          <Input
            id={altId}
            value={alt}
            onChange={(e) => onAltChange?.(e.target.value)}
            placeholder="Describe the image"
            disabled={disabled}
          />
        </div>
      ) : null}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept.join(",")}
        className="sr-only"
        disabled={disabled || busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      <style>{`@keyframes imgupload{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}`}</style>
    </div>
  );
}
