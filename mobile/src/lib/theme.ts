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

// Deterministic palette used to color category/wallet icon tiles and
// donut-chart segments — the backend has no `color` field (categories only
// carry a free-text `icon` string), so color is derived client-side.
// See src/lib/category-color.ts.
//
// 50 hand-picked hues, deliberately much larger than the 5-color theme
// accent set this replaced: with only 5 slots, any screen showing more than
// a handful of categories at once (Insights' donut + legend) was guaranteed
// to paint two different categories — e.g. Shopping and Food — the exact
// same color, which reads as "these are the same thing". Kept as a named
// object rather than a bare array so a specific slot can be referred to by
// name (`categoryColors.cat07`) when debugging a collision.
export const categoryColors = {
  cat01: "#F06666",
  cat02: "#8FF0AB",
  cat03: "#A638F5",
  cat04: "#F0DF66",
  cat05: "#8FDFF0",
  cat06: "#F5389E",
  cat07: "#88F066",
  cat08: "#938FF0",
  cat09: "#F57738",
  cat10: "#66F0BC",
  cat11: "#E88FF0",
  cat12: "#CDF538",
  cat13: "#66ABF0",
  cat14: "#F08FA3",
  cat15: "#38F548",
  cat16: "#9A66F0",
  cat17: "#F0D08F",
  cat18: "#38F5ED",
  cat19: "#F066CD",
  cat20: "#BBF08F",
  cat21: "#3857F5",
  cat22: "#F07766",
  cat23: "#8FF0B7",
  cat24: "#BE38F5",
  cat25: "#EFF066",
  cat26: "#8FD3F0",
  cat27: "#F53886",
  cat28: "#77F066",
  cat29: "#9F8FF0",
  cat30: "#F58F38",
  cat31: "#66F0CE",
  cat32: "#F08FEB",
  cat33: "#B5F538",
  cat34: "#6699F0",
  cat35: "#F08F96",
  cat36: "#38F560",
  cat37: "#AC66F0",
  cat38: "#F0DC8F",
  cat39: "#38E4F5",
  cat40: "#F066BB",
  cat41: "#AFF08F",
  cat42: "#383FF5",
  cat43: "#F08966",
  cat44: "#8FF0C4",
  cat45: "#D638F5",
  cat46: "#DEF066",
  cat47: "#8FC7F0",
  cat48: "#F5386E",
  cat49: "#66F067",
  cat50: "#AC8FF0",
} as const;

// Ordered view of the same 50 colors — what category-color.ts indexes into.
export const categoryPalette = Object.values(categoryColors);

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
