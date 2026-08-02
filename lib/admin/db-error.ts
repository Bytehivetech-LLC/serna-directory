import type { PostgrestError } from "@supabase/supabase-js";

/**
 * 7.1 — turn a swallowed Supabase error into a message worth showing. Our own
 * triggers raise descriptive, human-readable messages (validate_site_script,
 * validate_theme_setting, guard_profile_privileges, the site_url validator), so
 * a real failure should reach the admin instead of a fixed "Couldn't update
 * that." Never leaks a table name, column name, or SQL fragment.
 *
 * Pass the action name so the full error is always in the Vercel logs even when
 * the user sees the generic fallback.
 */
export function describeDbError(
  error: PostgrestError | null,
  fallback: string,
  actionName?: string,
): string {
  if (!error) return fallback;

  // Always log the real thing server-side.
  console.error(`[db-error]${actionName ? ` ${actionName}:` : ""}`, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });

  const raw = (error.message ?? "").trim();

  switch (error.code) {
    // Our triggers RAISE EXCEPTION with messages written for humans — surface
    // them verbatim (P0001 = raise_exception).
    case "P0001":
      return raw || fallback;
    case "23505": // unique_violation
      return "Something with that name already exists.";
    case "23503": // foreign_key_violation
      return "That's still in use somewhere, so it can't be changed.";
    case "23514": // check_violation — name the constraint in plain terms
      return "That value isn't allowed here.";
    case "23502": // not_null_violation
      return "A required field is missing.";
    case "42501": // insufficient_privilege / RLS
      return "You don't have permission to change that.";
    default:
      break;
  }

  // Some triggers surface via a message rather than P0001 — if the message looks
  // like a human sentence (has a space and no SQL-ish tokens), show it.
  if (
    raw &&
    /\s/.test(raw) &&
    !/relation|column|constraint|violates|syntax|null value|permission denied for/i.test(raw)
  ) {
    return raw;
  }

  return fallback;
}
