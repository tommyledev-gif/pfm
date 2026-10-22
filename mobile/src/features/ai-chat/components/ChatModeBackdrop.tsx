import { memo, useEffect, useId, useRef, useState } from "react";
import { Animated, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { CHAT_MODE_META, CHAT_MODE_ORDER, ChatMode } from "@/features/ai-chat/chat-mode";

// How strongly the mode's colours wash the ground: a glow under the header
// and another rising from behind the input, with the thread's middle left
// plain so text and charts sit on the app's own background.
const TOP_ALPHA = 0.13;
const BOTTOM_ALPHA = 0.08;
const CROSSFADE_MS = 280;

/**
 * The chat screen's background, tinted by the current mode — so switching
 * mode visibly changes the room, not just the header pill. One layer per
 * mode, cross-faded on the native driver; render it first, behind
 * everything, filling the whole screen including the status-bar strip
 * (a wash that started under it would leave a hard edge there).
 */
export const ChatModeBackdrop = memo(function ChatModeBackdrop({ mode }: { mode: ChatMode }) {
  const opacities = useRef(
    Object.fromEntries(CHAT_MODE_ORDER.map((m) => [m, new Animated.Value(m === mode ? 1 : 0)])) as Record<
      ChatMode,
      Animated.Value
    >,
  ).current;

  // Only the washes actually visible are mounted: the current one, plus the
  // outgoing one while it fades. Three full-screen SVG gradients drawn at once
  // were a large part of what made the tab slow to show.
  const [mounted, setMounted] = useState<ChatMode[]>([mode]);

  useEffect(() => {
    setMounted((prev) => (prev.includes(mode) ? prev : [...prev, mode]));
    const fade = Animated.parallel(
      CHAT_MODE_ORDER.map((m) =>
        Animated.timing(opacities[m], { toValue: m === mode ? 1 : 0, duration: CROSSFADE_MS, useNativeDriver: true }),
      ),
    );
    fade.start(({ finished }) => {
      if (finished) setMounted([mode]);
    });
    return () => fade.stop();
  }, [mode, opacities]);

  return (
    <>
      {CHAT_MODE_ORDER.filter((m) => mounted.includes(m)).map((m) => (
        <Animated.View key={m} pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: opacities[m] }]}>
          <ModeWash mode={m} />
        </Animated.View>
      ))}
    </>
  );
});

function ModeWash({ mode }: { mode: ChatMode }) {
  const { tint, accentTo } = CHAT_MODE_META[mode];
  const id = `chat-wash-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <Svg width="100%" height="100%">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={tint} stopOpacity={TOP_ALPHA} />
          <Stop offset="0.38" stopColor={tint} stopOpacity={0} />
          <Stop offset="0.7" stopColor={accentTo} stopOpacity={0} />
          <Stop offset="1" stopColor={accentTo} stopOpacity={BOTTOM_ALPHA} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
