"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/observability/report";

/**
 * Catches errors in the root layout itself — must render its own <html>/<body>.
 *
 * Colours here are INTENTIONALLY hardcoded (not theme tokens). This renders when
 * the app has already failed — the theme <style> block from the root layout may
 * never have been injected — so it cannot depend on the CSS variables. Keep the
 * literals in sync with the brand defaults by eye; do not "tokenise" them.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error, { digest: error.digest, scope: "global" });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Inter, Arial, sans-serif", background: "#f7f6fd", color: "#201f3a" }}>
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
          <h1 style={{ fontSize: 40, fontWeight: 800, margin: 0 }}>Something went wrong</h1>
          <p style={{ color: "#6e6c8a", marginTop: 16 }}>
            The site hit an unexpected error. Please try again in a moment.
          </p>
          <button
            onClick={reset}
            style={{ marginTop: 24, background: "#2e2e8f", color: "#fff", border: 0, borderRadius: 12, padding: "12px 22px", fontWeight: 700, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
