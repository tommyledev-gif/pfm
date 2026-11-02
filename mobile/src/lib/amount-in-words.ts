import { toMajorUnits } from "@/lib/currency";
import { currentLanguage, i18n, TranslationKey } from "@/lib/i18n";
import { numberToWordsEn } from "@/lib/number-to-words-en";
import { numberToWordsVi } from "@/lib/number-to-words-vi";
import { Language } from "@/locales/languages";

// What the spelled-out amount ends with — the unit, read the way it is said.
// A currency without a word here ends with its code ("… EUR") in both languages.
const CURRENCY_WORD_KEYS: Record<string, TranslationKey> = {
  VND: "format.amountWords.currency.VND",
  USD: "format.amountWords.currency.USD",
};

/**
 * An amount in cents, spelled out in the UI language with its currency at the
 * end: "một triệu năm trăm nghìn đồng" / "one million five hundred thousand
 * dong". The figure above it already shows "₫"; the words used to stop at the
 * number, so the line read as if it had no unit.
 *
 * ⚠️ The language is a parameter, read at call time by default — never fixed
 * to Vietnamese. The tooltip used to call the VI speller directly, so an app
 * switched to English still spelled every amount out in Vietnamese.
 */
export function amountInWords(amountCents: number, currency: string, language: Language = currentLanguage()): string {
  const code = currency.toUpperCase();
  const key = CURRENCY_WORD_KEYS[code];
  const unit = key ? i18n.t(key, { lng: language }) : code;
  const major = toMajorUnits(amountCents);
  const number = language === "en" ? numberToWordsEn(major) : numberToWordsVi(major);
  return `${number} ${unit}`;
}
