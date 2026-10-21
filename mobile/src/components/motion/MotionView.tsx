import { ReactNode, useCallback, useRef } from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated from "react-native-reanimated";

import { EntrancePreset, ExitPreset, entrance, exit, layoutSpring, staggerDelay } from "@/components/motion/motion-tokens";

interface MotionViewProps {
  children?: ReactNode;
  /** How it appears. Defaults to a short rise with a fade. */
  preset?: EntrancePreset;
  /** Position in a staggered group: row n waits n × STAGGER_MS (capped). */
  index?: number;
  /** Extra wait before the stagger starts, ms. */
  delay?: number;
  /** How it leaves, when it unmounts. None by default. */
  exitPreset?: ExitPreset;
  /** Slide into new positions when siblings above appear or leave. */
  animateLayout?: boolean;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: "auto" | "none" | "box-none" | "box-only";
  testID?: string;
}

/**
 * A View that animates in when it mounts (animate-ui's Fade/Slide/Zoom
 * primitives), optionally staggered by `index` and with an exit and layout
 * transition. Re-rendering does not replay it; only a remount does, so give
 * it a new `key` to play it again on purpose.
 */
export function MotionView({
  children,
  preset = "fadeUp",
  index = 0,
  delay = 0,
  exitPreset,
  animateLayout = false,
  style,
  pointerEvents,
  testID,
}: MotionViewProps) {
  return (
    <Animated.View
      testID={testID}
      style={style}
      pointerEvents={pointerEvents}
      entering={entrance(preset, staggerDelay(index, delay))}
      exiting={exitPreset ? exit(exitPreset) : undefined}
      layout={animateLayout ? layoutSpring() : undefined}
    >
      {children}
    </Animated.View>
  );
}

/** How long after a list mounts its rows still stagger in, ms. */
const LIST_ENTRANCE_WINDOW_MS = 700;

/**
 * For virtualised lists (FlatList, SectionList): the entering animation for
 * row `index`, but only for rows mounted in the list's first moments. Rows
 * mounted later (scrolled into view, loaded by the next page) appear as they
 * are: animating every row a user scrolls to reads as lag, not polish.
 *
 * `replayKey` starts a fresh window when it changes (a new filter, a tab
 * switch), so the new result set staggers in like the first one did.
 */
export function useListEntrance(replayKey?: unknown) {
  const startedAt = useRef(Date.now());
  const lastKey = useRef(replayKey);
  if (lastKey.current !== replayKey) {
    lastKey.current = replayKey;
    startedAt.current = Date.now();
  }

  return useCallback((index: number, preset: EntrancePreset = "fadeUp") => {
    if (Date.now() - startedAt.current > LIST_ENTRANCE_WINDOW_MS) return undefined;
    return entrance(preset, staggerDelay(index));
  }, []);
}
