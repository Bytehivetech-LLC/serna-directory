"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import type { ListingImage } from "@/lib/listing/types";
import { cn } from "@/lib/utils/cn";

export function ListingGallery({
  images,
  businessName,
}: {
  images: ListingImage[];
  businessName: string;
}) {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  const count = images.length;
  const go = useCallback(
    (dir: number) => setActive((i) => (i + dir + count) % count),
    [count],
  );

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, go]);

  if (count === 0) {
    return (
      <div className="flex aspect-[16/9] w-full items-center justify-center rounded-xl border border-border bg-gradient-to-br from-violet-soft to-secondary">
        <span className="font-display text-5xl font-extrabold text-violet/40">
          {(businessName[0] ?? "S").toUpperCase()}
        </span>
      </div>
    );
  }

  const cover = images[active];

  return (
    <div>
      <button
        type="button"
        onClick={() => setLightbox(true)}
        className="group relative block w-full overflow-hidden rounded-xl border border-border"
        aria-label="Open image gallery"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cover.url}
          alt={cover.alt}
          className="aspect-[16/9] w-full object-cover"
        />
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-lg bg-ink/70 px-2.5 py-1 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
          <Expand className="h-3.5 w-3.5" /> View
        </span>
      </button>

      {count > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show image ${i + 1}`}
              aria-current={i === active}
              className={cn(
                "h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                i === active ? "border-violet" : "border-transparent hover:border-border-strong",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.thumbUrl} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      {lightbox ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${businessName} images`}
          onClick={() => setLightbox(false)}
        >
          <button
            type="button"
            onClick={() => setLightbox(false)}
            aria-label="Close gallery"
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          {count > 1 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              aria-label="Previous image"
              className="absolute left-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover.url}
            alt={cover.alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
          />
          {count > 1 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              aria-label="Next image"
              className="absolute right-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          ) : null}
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/70">
            {active + 1} / {count}
          </span>
        </div>
      ) : null}
    </div>
  );
}
