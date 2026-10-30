// Polyfills Intl.PluralRules only where Hermes lacks it (or lacks a locale):
// i18next's _one/_other plurals are resolved through it.
import "intl-pluralrules";
import { createInstance, ParseKeys } from "i18next";
import { initReactI18next } from "react-i18next";
import { LocaleConfig } from "react-native-calendars";

import { resources } from "@/locales";
import { DEFAULT_LANGUAGE, Language, SUPPORTED_LANGUAGES } from "@/locales/languages";
import { useDebugLogStore } from "@/stores/debug-log-store";
import { useUiPrefsStore } from "@/stores/ui-prefs-store";

/**
 * The i18n layer (specs/mobile-language-switch §5.2–5.4). Imported first
 * thing by the root layout, so `t` works before any screen mounts.
 *
 * Resources are bundled and init is synchronous: a change of language is
 * applied within the call that makes it, so the first frame after the prefs
 * are read back is already in the stored language (D-06) and a switch lands
 * in one commit.
 *
 * In components: `const { t } = useTranslation()` — the hook is also what
 * re-renders a component on a switch, so a component that shows text built
 * by a helper must still call it. Outside React: `i18n.t(...)` at call time,
 * never a translated constant evaluated at import (it would stay in the
 * language the app started in).
 *
 * The app's own instance; `.use(initReactI18next)` makes it the one every
 * useTranslation() reads.
 */
const i18n = createInstance();
void i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES.map((option) => option.code),
  // React escapes; escaping here would print "&quot;" around wallet names.
  interpolation: { escapeValue: false },
  returnNull: false,
  initAsync: false,
  react: { useSuspense: false },
});

/** A translation key, for tables of labels kept outside a component. */
export type TranslationKey = ParseKeys;

// react-native-calendars reads month and weekday names from LocaleConfig, not
// from props; both languages are registered once and the default follows the
// language. A calendar only mounts inside a modal, so none is open during a
// switch from Preferences.
const list = (key: ParseKeys, lng: Language) => i18n.t(key, { lng }).split(", ");
for (const { code } of SUPPORTED_LANGUAGES) {
  LocaleConfig.locales[code] = {
    monthNames: list("format.calendar.monthNames", code),
    monthNamesShort: list("format.calendar.monthNamesShort", code),
    dayNames: list("format.calendar.dayNames", code),
    dayNamesShort: list("format.calendar.dayNamesShort", code),
    today: i18n.t("common.date.today", { lng: code }),
  };
}

function applyLanguage(language: Language) {
  LocaleConfig.defaultLocale = language;
  if (i18n.language !== language) void i18n.changeLanguage(language);
}

applyLanguage(useUiPrefsStore.getState().language);
// Registered at import, before the root layout subscribes to the same
// hydration: the language is in place by the time the splash can drop.
useUiPrefsStore.persist.onFinishHydration((state) => applyLanguage(state.language));
useUiPrefsStore.subscribe((state, previous) => {
  if (state.language !== previous.language) applyLanguage(state.language);
});

/**
 * A copy table for a module that keeps its strings together (`COPY.title`):
 * each field reads its key in the current language whenever it is read, so
 * the call sites stay as they are. Read it during render of a component that
 * calls useTranslation(), which is what re-renders it on a switch.
 */
export function copyOf<K extends string>(keys: Record<K, TranslationKey>): Readonly<Record<K, string>> {
  const copy = {} as Record<K, string>;
  for (const name of Object.keys(keys) as K[]) {
    Object.defineProperty(copy, name, { enumerable: true, get: () => String(i18n.t(keys[name])) });
  }
  return copy;
}

/** The language the UI is in right now — for helpers outside React. */
export function currentLanguage(): Language {
  return i18n.language === "en" ? "en" : "vi";
}

// BR-09: a key English lacks falls back to Vietnamese on screen; in
// development it is also listed in the debug console, so it gets noticed.
if (__DEV__) {
  const flatKeys = (tree: object, prefix = ""): string[] =>
    Object.entries(tree).flatMap(([key, value]) =>
      typeof value === "object" && value !== null ? flatKeys(value, `${prefix}${key}.`) : [`${prefix}${key}`],
    );
  // Plural forms differ by language (vi: _other; en: _one + _other).
  const base = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, "");
  const english = new Set(flatKeys(resources.en.translation).map(base));
  const missing = [...new Set(flatKeys(resources.vi.translation).map(base))].filter((key) => !english.has(key));
  if (missing.length > 0) {
    useDebugLogStore.getState().append("error", `i18n: ${missing.length} key(s) missing in en`, missing);
  }
}

export { i18n };
