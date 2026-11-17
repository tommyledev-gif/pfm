import { useEffect, useMemo, useRef } from "react";
import Animated, { Easing, FadeInLeft, FadeInRight, FadeOut } from "react-native-reanimated";

import { ChatMode } from "@/features/ai-chat/chat-mode";
import { ChatModeHeader } from "@/features/ai-chat/components/ChatModeHeader";
import { ChatSearchBar } from "@/features/ai-chat/components/ChatSearchBar";

// Small on purpose, like PeriodSlide: it only has to say which way the bar went.
const SLIDE_DISTANCE = 24;
const SLIDE_MS = 220;
// The bar leaving fades out as the other arrives, short enough that the two are
// not read as one ghosted picture.
const LEAVE_MS = 90;

interface ChatTopBarProps {
  /** The message search is open: its bar stands in for the header. */
  searching: boolean;
  mode: ChatMode;
  onSelectMode: (mode: ChatMode) => void;
  onPressSearch: () => void;
  onOpenManualEntry: () => void;
  query: string;
  onChangeQuery: (query: string) => void;
  searchableCount: number;
  onCloseSearch: () => void;
}

/**
 * The chat's top bar: ChatModeHeader, or ChatSearchBar while the thread is
 * searched. They share one 56px slot, so the thread below never moves, and the
 * swap is a short slide and fade — search comes in from the right (its back
 * arrow says "go back"), the header returns from the left — instead of one
 * frame being replaced by the next.
 *
 * ⚠️ Reanimated entering/exiting on keyed views, as PeriodSlide does, never an
 * RN Animated value started from an effect: the incoming bar has to be
 * committed invisible, and an effect starts its animation a frame or two
 * after that. The bar leaving fades where it was, which covers the frame
 * before the new one draws. Timed with an ease-out, not a spring: a spring
 * starts from rest and the new bar stays nearly transparent for its first
 * frames. What shows when the screen mounts just shows.
 */
export function ChatTopBar({
  searching,
  mode,
  onSelectMode,
  onPressSearch,
  onOpenManualEntry,
  query,
  onChangeQuery,
  searchableCount,
  onCloseSearch,
}: ChatTopBarProps) {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);

  // New builders per swap: Reanimated's builders are mutable.
  const { searchEntering, headerEntering, exiting } = useMemo(
    () => ({
      searchEntering: FadeInRight.withInitialValues({ opacity: 0, transform: [{ translateX: SLIDE_DISTANCE }] })
        .duration(SLIDE_MS)
        .easing(Easing.out(Easing.cubic)),
      headerEntering: FadeInLeft.withInitialValues({ opacity: 0, transform: [{ translateX: -SLIDE_DISTANCE }] })
        .duration(SLIDE_MS)
        .easing(Easing.out(Easing.cubic)),
      exiting: FadeOut.duration(LEAVE_MS),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searching],
  );

  if (searching) {
    return (
      <Animated.View key="search" entering={searchEntering} exiting={exiting}>
        <ChatSearchBar
          query={query}
          onChangeQuery={onChangeQuery}
          searchableCount={searchableCount}
          onClose={onCloseSearch}
        />
      </Animated.View>
    );
  }
  return (
    <Animated.View key="header" entering={mounted.current ? headerEntering : undefined} exiting={exiting}>
      <ChatModeHeader
        mode={mode}
        onSelectMode={onSelectMode}
        onPressSearch={onPressSearch}
        onOpenManualEntry={onOpenManualEntry}
      />
    </Animated.View>
  );
}
