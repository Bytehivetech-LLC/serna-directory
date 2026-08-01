// Client-side reCAPTCHA v3 helper. No-ops when no site key is configured, so
// forms keep working in dev without reCAPTCHA set up.

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(siteKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve) => {
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** Returns a token for `action`, or null if reCAPTCHA isn't configured/available. */
export async function executeRecaptcha(
  action: string,
): Promise<string | null> {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey) return null;
  await loadScript(siteKey);
  const grecaptcha = window.grecaptcha;
  if (!grecaptcha) return null;
  return new Promise<string | null>((resolve) => {
    grecaptcha.ready(() => {
      grecaptcha
        .execute(siteKey, { action })
        .then((token) => resolve(token))
        .catch(() => resolve(null));
    });
  });
}
