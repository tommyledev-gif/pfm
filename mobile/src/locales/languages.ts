// The app's UI languages (specs/mobile-language-switch D-02). Kept apart
// from the locale JSON so the prefs store can import the type and the guard
// without pulling every translation into its module.

// Each option is written in its own language (endonym), so someone who
// switched by mistake can still find the way back (D-05). Constants, not
// translated keys: "English" reads "English" in both languages.
export const SUPPORTED_LANGUAGES = [
  { code: "vi", label: "Tiếng Việt" },
  { code: "en", label: "English" },
] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number]["code"];

// D-03: Vietnamese on first launch, whatever the phone is set to.
export const DEFAULT_LANGUAGE: Language = "vi";

// Anything else in storage (an older build, a hand-edited value) reads as
// the default (BR-01).
export function isLanguage(value: unknown): value is Language {
  return SUPPORTED_LANGUAGES.some((option) => option.code === value);
}
