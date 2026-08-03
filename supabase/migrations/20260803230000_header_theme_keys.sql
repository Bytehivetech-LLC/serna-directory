-- Round 2 #8 — header-control colours in the theme. MERGE the new keys into any
-- existing theme / theme_draft / admin_theme rows WITHOUT overwriting a value the
-- admin already customised (defaults sit UNDER the existing value).
--
-- validate_theme_setting (see 20260803210000) validates ANY '#'-prefixed value
-- as a 6-digit hex, so these new hex keys are already covered — no trigger change
-- is needed to satisfy "hex-only".

update public.site_settings
set value =
  jsonb_build_object(
    'headerBorder',        '#34327e',
    'headerSearchBg',      '#35357e',
    'headerSearchText',    '#ffffff',
    'headerSearchBorder',  '#4a4a94',
    'headerSearchIcon',    '#b4b4d8',
    'headerButtonBg',      '#6c4ce8',
    'headerButtonText',    '#ffffff',
    'headerButtonHoverBg', '#5a3fd0',
    'headerLinkText',      '#cbcbe4',
    'headerLinkHoverText', '#ffffff'
  ) || value
where key in ('theme', 'theme_draft', 'admin_theme')
  and jsonb_typeof(value) = 'object';
