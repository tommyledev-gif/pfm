import { useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler } from "react-native";

import { buildSearchIndex, searchChat } from "@/features/ai-chat/chat-search";
import { ChatMessage } from "@/features/ai-chat/types";

/**
 * The header's message search, over the pane on screen (`messages`, newest
 * first). Only what is loaded is searched: older pages come in by scrolling
 * the thread back. The back button closes it before it leaves the screen.
 */
export function useChatSearch(messages: ChatMessage[]) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const index = useMemo(() => (open ? buildSearchIndex(messages) : []), [open, messages]);
  const hits = useMemo(() => searchChat(index, query), [index, query]);

  const openSearch = useCallback(() => setOpen(true), []);
  const closeSearch = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  useEffect(() => {
    if (!open) return;
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      closeSearch();
      return true;
    });
    return () => back.remove();
  }, [open, closeSearch]);

  return { open, query, setQuery, hits, searchableCount: index.length, openSearch, closeSearch };
}
