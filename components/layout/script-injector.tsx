import { getScriptsForRender, type Slot } from "@/lib/scripts/active";

/**
 * Renders admin-configured tracking/analytics scripts into the PUBLIC layout.
 *
 * SECURITY — this component MUST NOT appear in the admin layout. An injected
 * script running on /admin could steal an admin session (total compromise), so
 * it self-guards on APP_TARGET (see getScriptsForRender) AND is only ever mounted
 * in app/(web)/layout.tsx. See `injectorAllowed()` for the assertable rule.
 */
export function injectorAllowed(appTarget: string | undefined): boolean {
  return appTarget !== "admin";
}

export async function ScriptInjector({ slot }: { slot: Slot }) {
  if (!injectorAllowed(process.env.APP_TARGET)) return null;
  const scripts = await getScriptsForRender();
  const codes = scripts[slot];
  if (!codes.length) return null;
  // Server-rendered inline scripts execute during initial parse. Codes are the
  // admin-approved snippets (guided) or custom code the DB has vetted.
  return <div hidden dangerouslySetInnerHTML={{ __html: codes.join("\n") }} />;
}
