"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

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

/** Footer link to reopen the banner. Clears the stored choice and reloads. */
export function ConsentReopenLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        document.cookie = `${COOKIE}=; path=/; max-age=0`;
        window.location.reload();
      }}
    >
      Cookie preferences
    </button>
  );
}

export function ConsentBanner({ enabled }: { enabled: boolean }) {
  const [show, setShow] = useState(false);
  const [prefs, setPrefs] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(true);

  useEffect(() => {
    if (enabled && readConsent() === null) setShow(true);
  }, [enabled]);

  if (!enabled || !show) return null;

  function apply(value: string) {
    writeConsent(value);
    setShow(false);
    window.location.reload();
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/98 backdrop-blur"
    >
      <div className="mx-auto max-w-[1060px] px-6 py-4">
        {!prefs ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink">
              We use cookies for essential features and, with your OK, analytics and marketing. You choose.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setPrefs(true)}>Preferences</Button>
              <Button variant="outline" onClick={() => apply("essential")}>Reject</Button>
              <Button onClick={() => apply("analytics,marketing")}>Accept</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div><div className="text-sm font-semibold text-ink">Essential</div><div className="text-xs text-muted-foreground">Always on — needed for the site to work.</div></div>
              <Switch checked disabled aria-label="Essential (always on)" />
            </div>
            <div className="flex items-center justify-between">
              <div><div className="text-sm font-semibold text-ink">Analytics</div><div className="text-xs text-muted-foreground">Helps us understand what is useful.</div></div>
              <Switch checked={analytics} onCheckedChange={setAnalytics} aria-label="Analytics" />
            </div>
            <div className="flex items-center justify-between">
              <div><div className="text-sm font-semibold text-ink">Marketing</div><div className="text-xs text-muted-foreground">Ads measurement and remarketing.</div></div>
              <Switch checked={marketing} onCheckedChange={setMarketing} aria-label="Marketing" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => apply("essential")}>Reject all</Button>
              <Button onClick={() => apply([analytics ? "analytics" : "", marketing ? "marketing" : ""].filter(Boolean).join(",") || "essential")}>Save choices</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
