import { useMemo } from "react";

import { normalizeText } from "@/lib/normalize-text";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useRecentPhrases } from "@/stores/recent-phrases-store";
import { useSavedPhrases } from "@/stores/saved-phrases-store";

// Re-rank only after typing pauses this long — keystrokes never wait on it.
export const PHRASE_FILTER_DEBOUNCE_MS = 300;
// More than this is a list nobody scrolls; the area is height-capped anyway.
const MAX_PHRASE_SUGGESTIONS = 30;

export interface PhraseSuggestion {
  text: string;
  saved: boolean;
}

interface Candidate extends PhraseSuggestion {
  key: string;
}

// Lower is better: starts-with beats contains; within each, saved beats recent.
function rank(candidate: Candidate, query: string): number | null {
  if (!query) return candidate.saved ? 0 : 1;
  const position = candidate.key.indexOf(query);
  if (position === -1) return null;
  const tier = position === 0 ? 0 : 2;
  return tier + (candidate.saved ? 0 : 1);
}

/**
 * Saved phrases, then recently confirmed ones, filtered by what is typed —
 * ignoring case and diacritics — once typing pauses. Never lists the exact
 * text already in the input.
 */
export function usePhraseSuggestions(input: string, userId: string | null): PhraseSuggestion[] {
  const saved = useSavedPhrases(userId);
  const recent = useRecentPhrases(userId);
  const query = normalizeText(useDebouncedValue(input, PHRASE_FILTER_DEBOUNCE_MS));
  const currentKey = normalizeText(input);

  // Saved first, each list already newest first; a recent phrase that is also
  // saved shows once, as saved.
  const candidates = useMemo<Candidate[]>(() => {
    const seen = new Set<string>();
    const out: Candidate[] = [];
    for (const [list, isSaved] of [[saved, true], [recent, false]] as const) {
      for (const phrase of list) {
        const key = normalizeText(phrase.text);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ text: phrase.text, saved: isSaved, key });
      }
    }
    return out;
  }, [saved, recent]);

  return useMemo(() => {
    const ranked: { candidate: Candidate; score: number; order: number }[] = [];
    candidates.forEach((candidate, order) => {
      if (candidate.key === currentKey) return;
      const score = rank(candidate, query);
      if (score !== null) ranked.push({ candidate, score, order });
    });
    ranked.sort((a, b) => a.score - b.score || a.order - b.order);
    return ranked.slice(0, MAX_PHRASE_SUGGESTIONS).map(({ candidate }) => ({
      text: candidate.text,
      saved: candidate.saved,
    }));
  }, [candidates, query, currentKey]);
}
