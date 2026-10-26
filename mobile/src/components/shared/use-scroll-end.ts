import { useRef } from "react";
import { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from "react-native";

// How close to the bottom counts as "reached": about two rows ahead, so the
// next page is usually in before the User gets there.
const END_THRESHOLD = 240;

/**
 * ScrollView props that call `onEndReached` when the bottom comes within
 * reach: once per approach (it re-arms after scrolling away or the content
 * growing), and also when the content is too short to scroll at all, which
 * a scroll event alone would never report. Nothing is attached without a
 * callback, so a ScrollView that does not page pays for no scroll events.
 */
export function useScrollEnd(onEndReached: (() => void) | undefined) {
  const metrics = useRef({ viewport: 0, content: 0, offset: 0 });
  const near = useRef(false);

  if (!onEndReached) return {};

  const check = () => {
    const { viewport, content, offset } = metrics.current;
    if (!viewport || !content) return;
    const isNear = content - (offset + viewport) < END_THRESHOLD;
    if (isNear && !near.current) onEndReached();
    near.current = isNear;
  };

  return {
    scrollEventThrottle: 64,
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      metrics.current.offset = e.nativeEvent.contentOffset.y;
      check();
    },
    onLayout: (e: LayoutChangeEvent) => {
      metrics.current.viewport = e.nativeEvent.layout.height;
      check();
    },
    onContentSizeChange: (_width: number, height: number) => {
      // More content (a page landed) moves the end away: ask again once the
      // User nears the new one.
      if (height > metrics.current.content) near.current = false;
      metrics.current.content = height;
      check();
    },
  };
}
