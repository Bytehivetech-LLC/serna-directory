-- 4.3 — give the admin panel its own theme (admin_theme), separate from the
-- public `theme`. Seeded with the current dark indigo-deep sidebar so nothing
-- changes visually on upgrade.
--
-- The app does NOT require this row to function — lib/theme/get-theme.ts
-- getAdminTheme() falls back to lib/theme/admin-defaults.ts. This seeds an
-- explicit, editable row.

insert into public.site_settings (key, value, is_public)
values (
  'admin_theme',
  jsonb_build_object(
    -- text
    'ink', '#201f3a', 'muted', '#6e6c8a', 'faint', '#a4a2bf',
    -- brand
    'indigo', '#2e2e8f', 'indigoDeep', '#232268', 'violet', '#6c4ce8', 'violetSoft', '#efeafd',
    -- surfaces
    'bg', '#f7f6fd', 'card', '#ffffff', 'border', '#e7e5f4', 'borderStrong', '#d5d2ec',
    -- status
    'good', '#1a8f5c', 'goodSoft', '#dcf3e8', 'warm', '#fff8f0', 'warmBorder', '#f4dfc0',
    'warnInk', '#7a5a1e', 'warnStrong', '#5c430f', 'warnIcon', '#b4791e',
    'danger', '#d64545', 'dangerSoft', '#fbe7e7', 'track', '#edecf7',
    -- header
    'headerBg', '#232268', 'headerText', '#ffffff',
    -- admin-only: sidebar + brand bar (current dark indigo-deep shell)
    'sidebarBg', '#232268', 'sidebarText', '#ffffff',
    'sidebarActiveBg', '#6c4ce8', 'sidebarActiveText', '#ffffff', 'sidebarBorder', '#34327e',
    'brandBarBg', '#232268', 'brandBarText', '#ffffff',
    -- shape + type
    'radius', '16px', 'fontDisplay', 'Bricolage Grotesque', 'fontBody', 'Inter'
  ),
  false  -- admin_theme is staff-only, not world-readable
)
on conflict (key) do nothing;

-- admin_logo_url: optional separate logo for the admin brand bar. No seed value
-- (falls back to the public logo, then the letter mark). Insert an empty row so
-- the setting key exists for the admin UI to update.
insert into public.site_settings (key, value, is_public)
values ('admin_logo_url', to_jsonb(''::text), false)
on conflict (key) do nothing;

-- NOTE (validate_theme_setting): if that trigger validates theme-shaped rows by
-- a KEY ALLOWLIST, extend it to accept the `admin_theme` key with the SAME
-- hex-only rules it applies to `theme` (plus the seven sidebar*/brandBar* keys).
-- If it only validates hex FORMAT of whatever keys are present, this seed and
-- future admin_theme writes already satisfy it and no change is needed. The
-- current trigger body isn't in this repo's migrations, so this is left as a
-- documented step rather than a blind ALTER.
