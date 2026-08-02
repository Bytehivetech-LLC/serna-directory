import { defaultTheme, type Theme } from "./defaults";

export type ThemePreset = { id: string; name: string; theme: Theme; builtIn?: boolean };

/** A warmer, terracotta-leaning palette — still WCAG-safe on the blocking pairs. */
const warmer: Theme = {
  ...defaultTheme,
  ink: "#2b2119",
  muted: "#6d5f4f",
  faint: "#a99a87",
  indigo: "#9a3f12",
  indigoDeep: "#6f2d0b",
  violet: "#c0562a",
  violetSoft: "#f6e7dc",
  bg: "#fbf6ef",
  card: "#ffffff",
  border: "#eaded0",
  borderStrong: "#d8c7b3",
  danger: "#c0392b",
  dangerSoft: "#f9e4e1",
  headerBg: "#6f2d0b",
  headerText: "#ffffff",
  radius: "14px",
};

/** A crisper, higher-contrast palette. */
const higherContrast: Theme = {
  ...defaultTheme,
  ink: "#14131f",
  muted: "#3f3d52",
  faint: "#5c5a72",
  indigo: "#1f1f6b",
  indigoDeep: "#161550",
  violet: "#4b2fd0",
  violetSoft: "#e7e1fb",
  bg: "#ffffff",
  card: "#ffffff",
  border: "#d3d1e6",
  borderStrong: "#b7b4d4",
  good: "#0f7a4a",
  goodSoft: "#d5efe1",
  danger: "#b81f1f",
  dangerSoft: "#f7dede",
  headerBg: "#161550",
  headerText: "#ffffff",
  radius: "10px",
};

export const BUILTIN_PRESETS: ThemePreset[] = [
  { id: "serna-default", name: "Serna default", theme: defaultTheme, builtIn: true },
  { id: "warmer", name: "Warmer", theme: warmer, builtIn: true },
  { id: "higher-contrast", name: "Higher contrast", theme: higherContrast, builtIn: true },
];
