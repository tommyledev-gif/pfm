// Every color the app paints with, per theme. A palette is a full set of the
// same keys — adding a theme means adding one object here plus its entry in
// THEMES, nothing else; adding a token means adding it to every palette
// (Palette's type makes a missing one a compile error).

// Dark "Noctis" — ported 1:1 from mobile/design_handoff_pfm_app/README.md
// ("Design tokens" section). The original and default theme.
const dark = {
  bgApp: "#050B14",
  // The native splash's own background (app.json → expo-splash-screen
  // backgroundColor), one step off bgApp. BrandSplash has to match the native
  // splash exactly, or the handoff between the two shows as a flicker. The
  // native splash cannot follow the theme, so this stays the same in every
  // palette.
  splashBg: "#050B15",
  surface: "#12161F",
  // One tonal step above `surface` — separates a control (a chip, the
  // user's own chat bubble) from the ground it sits on without a border.
  surfaceRaised: "#1B202B",
  surfaceBorder: "rgba(255,255,255,0.08)",
  textPrimary: "#F5F6F8",
  textSecondary: "rgba(255,255,255,0.55)",
  textMuted: "rgba(255,255,255,0.4)",

  green: "#85FF33",
  greenDark: "#0a521e",
  blueDark: "#207ca1",
  onGreen: "#06130A",
  lavender: "#B49AFF",
  mint: "#7EEBC0",
  peach: "#FF9E96",
  mustard: "#F2C94C",
  // Same amber as `mustard`, pulled back — for "đang tới gần ngưỡng"
  // states that share the warning's meaning but not its urgency.
  mustardSoft: "rgba(242,201,76,0.65)",
  periwinkle: "#9FB3FF",

  trackMuted: "rgba(255,255,255,0.22)",
  // Toggle (components/ui/Toggle.tsx). Its own tokens, not trackMuted/green:
  // on near-black the neon primary as a whole track and a near-white thumb
  // were the two brightest things on any settings screen. Both are pulled
  // down so a row of switches sits at the same weight as the text beside it.
  toggleTrackOff: "rgba(255,255,255,0.12)",
  toggleTrackOn: "#35800F",
  toggleThumb: "#A9B0BB",
  // Fully opaque — the translucent blur let scrolling content show through
  // the bar, which read as the nav being washed out.
  navBg: "#0F1116",
  navBorder: "rgba(255,255,255,0.08)",
  error: "#FF9E96",
  // Solid fill for destructive buttons that must read as "this deletes" at a
  // glance. `peach` is too light to carry white text; this red is not.
  danger: "#E5484D",
  onDanger: "#FFFFFF",
  info: "#5dbde3",
  warning: "#F2C94C",

  // Ink for translucent washes (a field's fill, a pressed row, a sheet
  // handle): always used through withAlpha(colors.overlayBase, a). White on a
  // dark ground lightens; the light theme's dark ink darkens by the same
  // alpha — never a literal rgba(255,255,255,a), which vanishes on white.
  overlayBase: "#FFFFFF",
};

export type Palette = { [K in keyof typeof dark]: string };

// Light — same brand primary, re-tuned for a white ground. The dark theme's
// accents are pastels chosen to glow on near-black; on white they wash out,
// so every token that is also used as TEXT is pulled darker until it clears
// ~4:1 on `surface` (checked numerically, not by eye):
//   - green keeps the primary's hue (~96°) but #85FF33 is 1.3:1 on white —
//     unreadable as the income figures and links it also colors.
//   - onGreen flips to white: dark text on the deeper green drops to 4.6:1.
//   - greenDark/blueDark are tag fills behind dark-theme light text; here
//     they become pale tints behind dark text instead.
const light: Palette = {
  bgApp: "#F3F5F8",
  splashBg: dark.splashBg,
  surface: "#FFFFFF",
  surfaceRaised: "#E9EDF2",
  surfaceBorder: "rgba(15,23,42,0.09)",
  textPrimary: "#141821",
  textSecondary: "rgba(20,24,33,0.62)",
  textMuted: "rgba(20,24,33,0.45)",

  green: "#3A8F0B",
  greenDark: "#D8F2C4",
  blueDark: "#D3EAF5",
  onGreen: "#FFFFFF",
  lavender: "#6B4FD8",
  mint: "#0E8763",
  peach: "#D93F36",
  mustard: "#9A6B00",
  mustardSoft: "rgba(154,107,0,0.7)",
  periwinkle: "#4361D8",

  trackMuted: "rgba(15,23,42,0.12)",
  // A lighter green than the primary (which reads heavy as a solid fill this
  // size) and a white thumb — the dark ink thumb looked like a hole on white.
  toggleTrackOff: "rgba(15,23,42,0.16)",
  toggleTrackOn: "#52B52A",
  toggleThumb: "#FFFFFF",
  navBg: "#FFFFFF",
  navBorder: "rgba(15,23,42,0.08)",
  error: "#D93F36",
  danger: "#E5484D",
  onDanger: "#FFFFFF",
  info: "#1A7FAE",
  warning: "#9A6B00",

  overlayBase: "#0F172A",
};

export type ThemeName = "dark" | "light";

export interface ThemeDefinition {
  label: string;
  palette: Palette;
  // Whether the palette's ground is dark — drives the status bar's icon
  // color, the navigation theme's base and the keyboard's appearance.
  isDark: boolean;
}

// Display order of the Settings → Giao diện picker.
export const THEMES: Record<ThemeName, ThemeDefinition> = {
  dark: { label: "Tối", palette: dark, isDark: true },
  light: { label: "Sáng", palette: light, isDark: false },
};

export const THEME_NAMES = Object.keys(THEMES) as ThemeName[];

export const DEFAULT_THEME: ThemeName = "dark";
