import catalog from "@/lib/openmoji/catalog.json";
import type { TranslationKey } from "@/lib/i18n";

// OpenMoji (https://openmoji.org) — the open-source emoji set every icon
// picker in the app draws from.
//
// catalog.json is a trimmed copy of openmoji@17.0.0's data/openmoji.json:
// [emoji, hexcode, groupIndex, annotation] per entry, skin-tone variants and
// OpenMoji's private-use "extras" dropped (those have no standard Unicode
// character, so they could not be stored in `icon` and shown by the web app
// as plain text). Regenerate from that file if the version is bumped.
//
// ⚠️ What gets STORED is still the plain Unicode emoji — the backend and the
// web client are unchanged. OpenMoji only changes how the mobile app DRAWS
// it: the matching artwork, by hexcode, from the OpenMoji repo on jsDelivr.
//
// Loaded through expo-image with a memory+disk cache (components/ui/
// EmojiGlyph.tsx), so each PNG is downloaded once per device and served
// locally after that — which keeps the app ~3 MB lighter than bundling all
// 1,914 of them. The version is pinned so the artwork always matches this
// catalog and the CDN's cache stays stable.
const OPENMOJI_VERSION = "17.0.0";
const PNG_BASE = `https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@${OPENMOJI_VERSION}/color/72x72`;

export type OpenMojiGroupKey =
  | "smileys-emotion"
  | "people-body"
  | "animals-nature"
  | "food-drink"
  | "travel-places"
  | "activities"
  | "objects"
  | "symbols"
  | "flags";

export interface OpenMoji {
  emoji: string;
  hexcode: string;
  group: OpenMojiGroupKey;
  annotation: string;
}

// Chip labels are UI (locale keys); each emoji's annotation is OpenMoji's own
// English data and is not translated.
const GROUP_LABEL_KEYS: Record<OpenMojiGroupKey, TranslationKey> = {
  "food-drink": "ui.openMoji.group.foodDrink",
  objects: "ui.openMoji.group.objects",
  "travel-places": "ui.openMoji.group.travelPlaces",
  activities: "ui.openMoji.group.activities",
  "animals-nature": "ui.openMoji.group.animalsNature",
  "smileys-emotion": "ui.openMoji.group.smileysEmotion",
  "people-body": "ui.openMoji.group.peopleBody",
  symbols: "ui.openMoji.group.symbols",
  flags: "ui.openMoji.group.flags",
};

// Picker order — the groups a finance label most often comes from first.
export const OPENMOJI_GROUPS: { key: OpenMojiGroupKey; labelKey: TranslationKey }[] = (
  Object.keys(GROUP_LABEL_KEYS) as OpenMojiGroupKey[]
).map((key) => ({ key, labelKey: GROUP_LABEL_KEYS[key] }));

const groupKeys = catalog.groups as OpenMojiGroupKey[];

export const OPENMOJIS: OpenMoji[] = (catalog.emojis as [string, string, number, string][]).map(
  ([emoji, hexcode, group, annotation]) => ({ emoji, hexcode, group: groupKeys[group], annotation }),
);

export const OPENMOJIS_BY_GROUP: Record<OpenMojiGroupKey, OpenMoji[]> = OPENMOJIS.reduce(
  (acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  },
  {} as Record<OpenMojiGroupKey, OpenMoji[]>,
);

// Stored icons may or may not carry the U+FE0F variation selector depending
// on where they were typed, so both spellings resolve to the same entry.
const stripVariation = (s: string) => s.replace(/️/g, "");
const byEmoji = new Map<string, OpenMoji>();
for (const item of OPENMOJIS) {
  byEmoji.set(item.emoji, item);
  byEmoji.set(stripVariation(item.emoji), item);
}

/** The OpenMoji entry for a stored icon, or undefined for anything that isn't one (legacy text labels). */
export function findOpenMoji(icon: string | null | undefined): OpenMoji | undefined {
  if (!icon) return undefined;
  return byEmoji.get(icon) ?? byEmoji.get(stripVariation(icon));
}

/** The CDN URL of a hexcode's 72×72 PNG artwork. */
export function openMojiImageUrl(hexcode: string): string {
  return `${PNG_BASE}/${hexcode.toUpperCase()}.png`;
}

/** The artwork URL for a stored icon, or undefined when it isn't an OpenMoji emoji. */
export function openMojiUrlForIcon(icon: string | null | undefined): string | undefined {
  const entry = findOpenMoji(icon);
  return entry ? openMojiImageUrl(entry.hexcode) : undefined;
}

/** Case-insensitive match on the English annotation (the only name OpenMoji ships). */
export function searchOpenMoji(query: string): OpenMoji[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return OPENMOJIS.filter((item) => item.annotation.toLowerCase().includes(q));
}
