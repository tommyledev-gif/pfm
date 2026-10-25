import { isTombstone } from "@/features/ai-chat/tombstone";
import { ChatMessage } from "@/features/ai-chat/types";
import { normalizeForSearch } from "@/lib/search-text";

// A result's snippet: this much of the text before the match, and this much
// in all, so two lines show the match with some of what surrounds it.
const LEAD_CHARS = 24;
const SNIPPET_CHARS = 90;

interface SearchEntry {
  message: ChatMessage;
  /** What the message shows, NFC, beside the same text folded for matching. */
  texts: { shown: string; folded: string }[];
}

export interface ChatSearchHit {
  message: ChatMessage;
  /** The snippet in three parts, so the match can be drawn apart from the rest. */
  before: string;
  match: string;
  after: string;
}

// The words a message shows: its bubble text, unless the card under it took
// its place (a saved or removed proposal, see ChatMessageRow), and a
// proposal's note.
function shownTexts(message: ChatMessage): string[] {
  const cardOnly = message.action !== undefined && (Boolean(message.confirmed) || isTombstone(message));
  return [cardOnly ? "" : message.text, message.action?.payload.note ?? ""].filter((text) => text.trim() !== "");
}

// Case, diacritics and đ folded away, one character for one, so a match's
// place in the folded text is its place in the shown text too.
function fold(shown: string): string {
  const whole = shown
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
  if (whole.length === shown.length) return whole;
  return shown
    .split("")
    .map((ch) => normalizeForSearch(ch).charAt(0) || " ")
    .join("");
}

/** Folded once when the search opens, not on every keystroke. */
export function buildSearchIndex(messages: ChatMessage[]): SearchEntry[] {
  const index: SearchEntry[] = [];
  for (const message of messages) {
    const texts = shownTexts(message).map((text) => {
      const shown = text.normalize("NFC");
      return { shown, folded: fold(shown) };
    });
    if (texts.length > 0) index.push({ message, texts });
  }
  return index;
}

const flat = (text: string) => text.replace(/\s+/g, " ");

/** Every message showing `query`, in the index's order (newest first). */
export function searchChat(index: SearchEntry[], query: string): ChatSearchHit[] {
  const needle = normalizeForSearch(query);
  if (!needle) return [];
  const hits: ChatSearchHit[] = [];
  for (const { message, texts } of index) {
    for (const { shown, folded } of texts) {
      const at = folded.indexOf(needle);
      if (at === -1) continue;
      let start = Math.max(0, at - LEAD_CHARS);
      // Starts on a word, not halfway through one.
      const space = shown.indexOf(" ", start);
      if (start > 0 && space !== -1 && space < at) start = space + 1;
      const end = Math.min(shown.length, Math.max(start + SNIPPET_CHARS, at + needle.length));
      hits.push({
        message,
        before: (start > 0 ? "…" : "") + flat(shown.slice(start, at)),
        match: shown.slice(at, at + needle.length),
        after: flat(shown.slice(at + needle.length, end)) + (end < shown.length ? "…" : ""),
      });
      break;
    }
  }
  return hits;
}
