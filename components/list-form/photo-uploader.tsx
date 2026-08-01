"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { processImage, type ProcessedImage } from "@/lib/list-form/image-processing";
import { cn } from "@/lib/utils/cn";

export function PhotoUploader({
  images,
  onChange,
  max,
}: {
  images: ProcessedImage[];
  onChange: (images: ProcessedImage[]) => void;
  max: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dragIndex = useRef<number | null>(null);

  async function addFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const room = max - images.length;
    if (room <= 0) {
      toast.error(`You can add up to ${max} photos on this plan.`);
      return;
    }
    setBusy(true);
    const next: ProcessedImage[] = [];
    for (const file of list.slice(0, room)) {
      try {
        next.push(await processImage(file));
      } catch {
        toast.error(`Couldn't process ${file.name}.`);
      }
    }
    if (next.length) onChange([...images, ...next]);
    setBusy(false);
  }

  function remove(id: string) {
    const target = images.find((i) => i.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    onChange(images.filter((i) => i.id !== id));
  }

  function reorder(from: number, to: number) {
    if (from === to) return;
    const copy = [...images];
    const [moved] = copy.splice(from, 1);
    copy.splice(to, 0, moved);
    onChange(copy);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-xl border-[1.5px] border-dashed bg-bg p-6 text-center transition-colors",
          dragOver ? "border-violet bg-violet-soft" : "border-border-strong",
        )}
      >
        <div className="text-sm font-semibold text-ink">
          Drag &amp; drop, or{" "}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-indigo underline underline-offset-2"
          >
            add photos
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          JPG, PNG, or WebP · up to {max} · any size, we handle the rest
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {busy ? (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…
          </p>
        ) : null}

        {images.length > 0 ? (
          <div className="mt-4 flex flex-wrap justify-center gap-2.5">
            {images.map((img, i) => (
              <div
                key={img.id}
                draggable
                onDragStart={() => (dragIndex.current = i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (dragIndex.current !== null) reorder(dragIndex.current, i);
                  dragIndex.current = null;
                }}
                className="group relative h-16 w-24 cursor-move overflow-hidden rounded-lg border border-border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.previewUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
                {i === 0 ? (
                  <span className="absolute bottom-1 left-1 rounded bg-indigo px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white">
                    COVER
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => remove(img.id)}
                  aria-label="Remove photo"
                  className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-ink/70 text-[11px] leading-none text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 flex justify-center">
            <ImagePlus className="h-8 w-8 text-faint" aria-hidden />
          </div>
        )}
      </div>
      {images.length > 1 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Drag to reorder · the first photo is your cover.
        </p>
      ) : null}
    </div>
  );
}
