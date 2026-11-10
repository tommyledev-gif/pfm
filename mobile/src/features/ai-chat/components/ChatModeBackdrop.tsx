import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { CHAT_MODE_META, CHAT_MODE_ORDER, ChatMode } from "@/features/ai-chat/chat-mode";
import { withAlpha } from "@/lib/color";

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
  // outgoing one while it fades.
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

// ⚠️ RN's own gradient, not react-native-svg (2026-11-10): on Android an SVG
// is a bitmap the size of the view, here the whole screen (~10MB, two while
// modes cross-fade), drawn and uploaded to the GPU again each time the tab
// was shown. A shader has no bitmap. See GradientFill.
function ModeWash({ mode }: { mode: ChatMode }) {
  const { tint, accentTo } = CHAT_MODE_META[mode];
  const style = useMemo(() => {
    const stops = [
      `${withAlpha(tint, TOP_ALPHA)} 0%`,
      `${withAlpha(tint, 0)} 38%`,
      `${withAlpha(accentTo, 0)} 70%`,
      `${withAlpha(accentTo, BOTTOM_ALPHA)} 100%`,
    ];
    return [StyleSheet.absoluteFill, { experimental_backgroundImage: `linear-gradient(to bottom, ${stops.join(", ")})` }];
  }, [tint, accentTo]);
  return <View style={style} />;
}
