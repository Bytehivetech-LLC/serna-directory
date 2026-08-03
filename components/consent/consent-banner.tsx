"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const COOKIE = "serna-consent";
const YEAR = 60 * 60 * 24 * 365;

function readConsent(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)serna-consent=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : null;
}
function writeConsent(value: string) {
  document.cookie = `${COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${YEAR}; samesite=lax`;
}

// One shared channel so the footer link and the banner agree on a single source
// of truth for "open the preferences dialog" — no cookie clearing, no reload.
const openers = new Set<() => void>();
function openPreferences() {
  openers.forEach((fn) => fn());
}

/**
 * Footer "Cookie preferences" link. Opens the preferences dialog directly. Hidden
 * entirely when the consent banner is disabled in settings (so it never links to
 * nothing).
 */
export function ConsentReopenLink({
  className,
  enabled = true,
}: {
  className?: string;
  enabled?: boolean;
}) {
  if (!enabled) return null;
  return (
    <button type="button" className={className} onClick={openPreferences}>
      Cookie preferences
    </button>
  );
}

export function ConsentBanner({ enabled }: { enabled: boolean }) {
  const [bannerOpen, setBannerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(true);

  // First-visit banner: only when enabled and no choice recorded yet.
  useEffect(() => {
    if (enabled && readConsent() === null) setBannerOpen(true);
  }, [enabled]);

  // Reopen from the footer link — pre-set toggles to the CURRENT choice so the
  // visitor adjusts rather than starting over.
  useEffect(() => {
    const open = () => {
      const cur = readConsent();
      setAnalytics(cur ? cur.includes("analytics") : true);
      setMarketing(cur ? cur.includes("marketing") : true);
      setModalOpen(true);
    };
    openers.add(open);
    return () => {
      openers.delete(open);
    };
  }, []);

  function apply(value: string) {
    writeConsent(value);
    setBannerOpen(false);
    setModalOpen(false);
    // Enable/disable the corresponding scripts by re-rendering the injected set.
    window.location.reload();
  }

  const saveFromToggles = () =>
    apply([analytics ? "analytics" : "", marketing ? "marketing" : ""].filter(Boolean).join(",") || "essential");

  return (
    <>
      {/* First-visit banner */}
      {enabled && bannerOpen ? (
        <div
          role="dialog"
          aria-label="Cookie consent"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/98 backdrop-blur"
        >
          <div className="mx-auto flex max-w-[var(--content-max)] flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink">
              We use cookies for essential features and, with your OK, analytics and marketing. You choose.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setModalOpen(true)}>Preferences</Button>
              <Button onClick={() => apply("essential")}>Reject all</Button>
              <Button onClick={() => apply("analytics,marketing")}>Accept all</Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Preferences dialog (reopened from the footer, or "Preferences" above).
          Focus is trapped, Escape closes, focus returns to the trigger. */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Cookie preferences</DialogTitle>
            <DialogDescription>Choose what we may store. You can change this anytime.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-ink">Essential</div>
                <div className="text-xs text-muted-foreground">Always on — needed for the site to work.</div>
              </div>
              <Switch checked disabled aria-label="Essential (always on)" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-ink">Analytics</div>
                <div className="text-xs text-muted-foreground">Helps us understand what is useful.</div>
              </div>
              <Switch checked={analytics} onCheckedChange={setAnalytics} aria-label="Analytics" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-ink">Marketing</div>
                <div className="text-xs text-muted-foreground">Ads measurement and remarketing.</div>
              </div>
              <Switch checked={marketing} onCheckedChange={setMarketing} aria-label="Marketing" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button className="flex-1" onClick={() => apply("essential")}>Reject all</Button>
            <Button className="flex-1" variant="outline" onClick={saveFromToggles}>Save choices</Button>
            <Button className="flex-1" onClick={() => apply("analytics,marketing")}>Accept all</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
