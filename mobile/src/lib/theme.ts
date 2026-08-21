// Design tokens ported 1:1 from mobile/design_handoff_pfm_app/README.md
// ("Design tokens" section) — the dark "Noctis" theme. This is the only
// place hex values / radii / spacing should be hardcoded; screens and
// components must reference these, never inline a color literal.
export const colors = {
  bgApp: "#050B14",
  surface: "#12161F",
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
  periwinkle: "#9FB3FF",

  trackMuted: "rgba(255,255,255,0.22)",
  navBg: "rgba(15,17,22,0.72)",
  navBorder: "rgba(255,255,255,0.08)",
  error: "#FF9E96",
  info: "#5dbde3",
  warning: "#F2C94C",
  
} as const;

// Deterministic palette used to color category/wallet icon circles and
// donut-chart segments — the backend has no `color` field (categories only
// carry a free-text `icon` string), so color is derived client-side.
// See src/lib/category-color.ts.
export const categoryPalette = [
  colors.mint,
  colors.lavender,
  colors.mustard,
  colors.periwinkle,
  colors.peach,
] as const;

export const radii = {
  hero: 24,
  card: 20,
  listCard: 16,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const typography = {
  hero: { fontSize: 32, fontWeight: "800" as const },
  title: { fontSize: 20, fontWeight: "700" as const },
  cardTitle: { fontSize: 17, fontWeight: "700" as const },
  body: { fontSize: 15, fontWeight: "600" as const },
  label: { fontSize: 13, fontWeight: "600" as const },
  caption: { fontSize: 12, fontWeight: "600" as const },
  tiny: { fontSize: 11, fontWeight: "500" as const },
} as const;
