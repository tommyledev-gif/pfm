import { i18n, TranslationKey } from "@/lib/i18n";
import { Category } from "@/features/categories/types";

/**
 * The name to show for a category (specs/mobile-language-switch D-11). A
 * system category reads in the app language from its system_key ("Ăn uống"
 * / "Food & drink"); a category the User created is their own data and is
 * never translated (BR-07).
 *
 * `fallback` is the name a DTO carried (category_name) for when the category
 * is not in the cached list — a shared wallet owner's category, say.
 * Call it during render of a component that uses useTranslation(), so the
 * label follows a switch.
 */
export function categoryLabel(
  category: Pick<Category, "name" | "system_key"> | null | undefined,
  fallback = "",
): string {
  if (!category) return fallback;
  if (category.system_key) {
    const key = `categories.system.${category.system_key}`;
    if (i18n.exists(key)) return i18n.t(key as TranslationKey);
  }
  return category.name;
}
