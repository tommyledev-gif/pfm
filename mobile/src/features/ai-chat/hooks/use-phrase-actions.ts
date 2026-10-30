import { MAX_SAVED_PHRASES, useSavedPhrases, useSavedPhrasesStore } from "@/stores/saved-phrases-store";
import { samePhrase } from "@/stores/phrase-list";
import { useRecentPhrasesStore } from "@/stores/recent-phrases-store";
import { useCurrentUserId } from "@/stores/use-current-user-id";
import { useToastStore } from "@/stores/toast-store";
import { i18n } from "@/lib/i18n";

const SAVED_MESSAGE = "chat.phrases.saved.toast";
const REMOVED_MESSAGE = "chat.phrases.unsaved.toast";
const FULL_MESSAGE = "chat.phrases.full.toast";
const DELETED_MESSAGE = "chat.phrases.deleted.toast";

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
      toast.show(i18n.t(REMOVED_MESSAGE), "info");
      return;
    }
    const result = store.save(userId, trimmed);
    if (result === "saved") toast.show(i18n.t(SAVED_MESSAGE), "info");
    else if (result === "full") toast.show(i18n.t(FULL_MESSAGE, { max: MAX_SAVED_PHRASES }), "warning");
  };

  // Gone from the suggestions altogether: saved and recent both.
  const remove = () => {
    if (!userId || !trimmed) return;
    useSavedPhrasesStore.getState().remove(userId, trimmed);
    useRecentPhrasesStore.getState().remove(userId, trimmed);
    useToastStore.getState().show(i18n.t(DELETED_MESSAGE), "info");
  };

  return { available, saved: isSaved, toggle, remove };
}
