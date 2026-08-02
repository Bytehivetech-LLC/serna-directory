import { defaultTheme, type Theme } from "./defaults";

/**
 * The admin panel gets its own theme, independent of the public site. It's the
 * full public Theme shape plus the sidebar + brand-bar colours that only the
 * admin shell uses.
 */
export type AdminTheme = Theme & {
  sidebarBg: string;
  sidebarText: string;
  sidebarActiveBg: string;
  sidebarActiveText: string;
  sidebarBorder: string;
  brandBarBg: string;
  brandBarText: string;
};

/** The extra keys admin_theme adds on top of the public Theme. */
export const ADMIN_EXTRA_KEYS = [
  "sidebarBg",
  "sidebarText",
  "sidebarActiveBg",
  "sidebarActiveText",
  "sidebarBorder",
  "brandBarBg",
  "brandBarText",
] as const satisfies ReadonlyArray<keyof AdminTheme>;

export const ADMIN_EXTRA_CSS_VAR: Record<(typeof ADMIN_EXTRA_KEYS)[number], string> = {
  sidebarBg: "--c-sidebar-bg",
  sidebarText: "--c-sidebar-text",
  sidebarActiveBg: "--c-sidebar-active-bg",
  sidebarActiveText: "--c-sidebar-active-text",
  sidebarBorder: "--c-sidebar-border",
  brandBarBg: "--c-brand-bar-bg",
  brandBarText: "--c-brand-bar-text",
};

/**
 * Seeded with the current dark indigo-deep sidebar, so nothing changes visually
 * on upgrade. The base (public-theme) portion mirrors defaultTheme.
 */
export const defaultAdminTheme: AdminTheme = {
  ...defaultTheme,
  sidebarBg: "#232268", // indigo-deep
  sidebarText: "#ffffff",
  sidebarActiveBg: "#6c4ce8", // violet
  sidebarActiveText: "#ffffff",
  sidebarBorder: "#34327e",
  brandBarBg: "#232268",
  brandBarText: "#ffffff",
};
