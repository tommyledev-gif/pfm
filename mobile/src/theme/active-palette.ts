import { DEFAULT_THEME, Palette, THEMES, ThemeName } from "@/theme/palettes";

// The palette of the theme currently on screen, as one long-lived object
// whose values are swapped in place on a theme change.
//
// Components never read this directly — they call useColors()/a
// createStyles() hook, which is what re-renders them on a change. It exists
// for plain functions that resolve a color at call time (a status → color
// helper, a chart's segment builder): those run during some component's
// render, after the swap below, so they see the new theme without needing
// a hook of their own.
//
// ⚠️ Anything that copies a value out of it at module load (a top-level
// `const X = colors.green`) freezes the theme it loaded with. Resolve inside
// a function instead.
export const colors: Palette = { ...THEMES[DEFAULT_THEME].palette };

export function applyPalette(name: ThemeName): void {
  Object.assign(colors, THEMES[name].palette);
}
