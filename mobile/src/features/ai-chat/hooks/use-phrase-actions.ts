import { MAX_SAVED_PHRASES, useSavedPhrases, useSavedPhrasesStore } from "@/stores/saved-phrases-store";
import { samePhrase } from "@/stores/phrase-list";
import { useCurrentUserId } from "@/stores/use-current-user-id";
import { useToastStore } from "@/stores/toast-store";

const SAVED_MESSAGE = "Đã lưu câu mẫu";
const REMOVED_MESSAGE = "Đã bỏ lưu câu mẫu";
const FULL_MESSAGE = `Đã đủ ${MAX_SAVED_PHRASES} câu mẫu — bỏ bớt một câu trước nhé`;

/**
 * Save / Remove-saved toggle for one phrase. Unavailable (and so never
 * offered) without a phrase or a known User — saved phrases are per User.
 */
export function usePhraseActions(text: string | null) {
  const userId = useCurrentUserId();
  const saved = useSavedPhrases(userId);
  const trimmed = text?.trim() ?? "";
  const available = Boolean(userId && trimmed);
  const isSaved = available && saved.some((p) => samePhrase(p.text, trimmed));

  const toggle = () => {
    if (!userId || !trimmed) return;
    const store = useSavedPhrasesStore.getState();
    const toast = useToastStore.getState();
    if (isSaved) {
      store.remove(userId, trimmed);
      toast.show(REMOVED_MESSAGE, "info");
      return;
    }
    const result = store.save(userId, trimmed);
    if (result === "saved") toast.show(SAVED_MESSAGE, "info");
    else if (result === "full") toast.show(FULL_MESSAGE, "warning");
  };

  return { available, saved: isSaved, toggle };
}
