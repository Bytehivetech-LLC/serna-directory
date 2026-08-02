"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Mail, Share2 } from "lucide-react";
import { FacebookIcon } from "./brand-icons";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";

const btn =
  "inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-card px-3 py-1.5 text-sm font-semibold text-muted-foreground no-underline transition-colors hover:border-violet hover:text-ink";

export function ShareRow({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  const e = encodeURIComponent;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title, url });
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={copy} className={btn}>
        {copied ? (
          <Check className="h-4 w-4 text-good" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
        Copy link
      </button>
      <a
        className={btn}
        href={`https://twitter.com/intent/tweet?url=${e(url)}&text=${e(title)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on X"
      >
        <span className="font-bold">X</span>
      </a>
      <a
        className={btn}
        href={`https://www.facebook.com/sharer/sharer.php?u=${e(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on Facebook"
      >
        <FacebookIcon className="h-4 w-4" />
      </a>
      <a
        className={btn}
        href={`mailto:?subject=${e(title)}&body=${e(url)}`}
        aria-label="Share by email"
      >
        <Mail className="h-4 w-4" />
      </a>
      {canNativeShare ? (
        <button
          type="button"
          onClick={nativeShare}
          className={cn(btn, "sm:hidden")}
        >
          <Share2 className="h-4 w-4" />
          Share
        </button>
      ) : null}
    </div>
  );
}
