import { RefObject, useEffect, useRef, useState } from "react";
import { FlatList } from "react-native";

import { ChatMessage } from "@/features/ai-chat/types";
import { useHighlightFade } from "@/lib/use-highlight-fade";
import { useLatestCallback } from "@/lib/use-latest-callback";

/** "Show this message": a search result picked, or a deep link. A new object per request. */
export interface MessageJump {
  id: string;
  nonce: number;
}

// A beat for the list to finish its mount/measure pass first (a pane that
// has just switched in, a thread just restored).
const SCROLL_DELAY_MS = 50;
const RETRY_DELAY_MS = 100;
const MAX_RETRIES = 5;

/**
 * Scrolls a pane's thread to the requested message and lights it up for a
 * moment (ChatRowFrame), when the message is in this pane.
 *
 * A row far from the one on screen is not rendered yet, and FlatList cannot
 * scroll to a row it has not measured: onScrollToIndexFailed first jumps to
 * where the rows' average height puts it, then aims again. Retrying the same
 * scroll from where the list was never got any closer.
 */
export function useMessageJump(
  listRef: RefObject<FlatList<ChatMessage> | null>,
  messages: ChatMessage[],
  jump: MessageJump | null,
) {
  const [highlight, setHighlight] = useState<MessageJump | null>(null);
  const retries = useRef(0);

  useEffect(() => {
    if (!jump) return;
    const index = messages.findIndex((m) => m.id === jump.id);
    if (index === -1) return;
    retries.current = 0;
    setHighlight(jump);
    const timer = setTimeout(
      () => listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 }),
      SCROLL_DELAY_MS,
    );
    return () => clearTimeout(timer);
    // Only a new request moves the list, not the thread changing under it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump]);

  const onScrollToIndexFailed = useLatestCallback((info: { index: number; averageItemLength: number }) => {
    if (retries.current >= MAX_RETRIES) return;
    retries.current += 1;
    listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
    setTimeout(
      () => listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 }),
      RETRY_DELAY_MS,
    );
  });

  const highlightOpacity = useHighlightFade(highlight ? `${highlight.id}:${highlight.nonce}` : null);
  return { highlightId: highlight?.id ?? null, highlightOpacity, onScrollToIndexFailed };
}
