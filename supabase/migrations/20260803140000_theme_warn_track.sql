-- 4.2 — fold the previously-hardcoded warn/track colours into the theme system.
--
-- Adds warnInk / warnStrong / warnIcon (text/icon on the "warm" surface) and
-- track (progress-bar track) to any existing `theme` / `theme_draft` rows.
--
-- The app does NOT depend on this migration to function — lib/theme/get-theme.ts
-- mergeTheme() already falls back to lib/theme/defaults.ts for any missing key,
-- and every future publish from the editor writes the full object. This backfill
-- just seeds the four new keys into rows saved before this change.
--
-- MERGE semantics: `defaults || value` puts the new defaults UNDER the existing
-- value, so any colour the admin already customised wins and nothing is
-- overwritten. Keys that don't exist yet (the four new ones) take the default.

update public.site_settings
set value =
  jsonb_build_object(
    'warnInk',   '#7a5a1e',
    'warnStrong','#5c430f',
    'warnIcon',  '#b4791e',
    'track',     '#edecf7'
  ) || value
where key in ('theme', 'theme_draft')
  and jsonb_typeof(value) = 'object';

-- NOTE: if validate_theme_setting enforces a key ALLOWLIST (rather than only
-- validating hex format), extend it to accept warnInk/warnStrong/warnIcon/track
-- before applying this — otherwise the trigger will reject the update. See 4.3,
-- which extends the same validator for the admin_theme key.
