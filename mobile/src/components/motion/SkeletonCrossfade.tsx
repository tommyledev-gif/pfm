import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from "react-native";

const CROSSFADE_MS = 180;

interface SkeletonCrossfadeProps {
  /** Show the skeleton: the first load, or content about to be replaced. */
  showSkeleton: boolean;
  skeleton: ReactNode;
  /** null while there is nothing to show: the skeleton then holds the block's height. */
  children: ReactNode;
  /** Keeps the skeleton invisible this long before it fades in (SKELETON_DELAY_MS for a first load). */
  delayMs?: number;
  /** Shared by the content and the skeleton (a list's row gap). */
  style?: StyleProp<ViewStyle>;
}

/**
 * A block that turns into its skeleton and back with a cross-fade, both ways.
 *
 * SkeletonSwap covers a first load only: when loading starts again it cuts the
 * content in one frame and leaves a gap until its skeleton fades in. Here the
 * content fades out while the skeleton fades in over it, for content replaced
 * while the User watches (the next wallet's list, Wallets screen).
 *
 * - With content: the skeleton is laid over it, and the hidden content takes
 *   no touches.
 * - Without (children null): the skeleton sits in the flow, holding the
 *   block's height, and fades in after `delayMs`, so a fast first load never
 *   shows it; the content then fades in once.
 * - Both on the native driver, so a busy JS thread cannot stall them.
 */
export function SkeletonCrossfade({ showSkeleton, skeleton, children, delayMs = 0, style }: SkeletonCrossfadeProps) {
  const content = useRef(new Animated.Value(showSkeleton ? 0 : 1)).current;
  const placeholder = useRef(new Animated.Value(showSkeleton && delayMs <= 0 ? 1 : 0)).current;
  const [mounted, setMounted] = useState(showSkeleton);
  // Mounted in the render that asks for it (transparent), never an effect later.
  if (showSkeleton && !mounted) setMounted(true);

  useEffect(() => {
    const easing = Easing.out(Easing.quad);
    const fade = (value: Animated.Value, toValue: number, delay = 0) =>
      Animated.timing(value, { toValue, duration: CROSSFADE_MS, delay, easing, useNativeDriver: true });
    const run = showSkeleton
      ? Animated.parallel([fade(content, 0), fade(placeholder, 1, delayMs)])
      : Animated.parallel([fade(content, 1), fade(placeholder, 0)]);
    run.start(({ finished }) => {
      if (finished && !showSkeleton) setMounted(false);
    });
    return () => run.stop();
  }, [showSkeleton, delayMs, content, placeholder]);

  // Built once: a new style node on a native-driven view puts it back to its
  // defaults (fully opaque) for a frame.
  const fades = useMemo(() => ({ content: { opacity: content }, placeholder: { opacity: placeholder } }), [content, placeholder]);
  const hasContent = children !== null && children !== undefined && children !== false;

  return (
    <View>
      {hasContent ? (
        <Animated.View style={[style, fades.content]} pointerEvents={showSkeleton ? "none" : "auto"}>
          {children}
        </Animated.View>
      ) : null}
      {mounted ? (
        <Animated.View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          style={[style, hasContent && styles.overlay, fades.placeholder]}
        >
          {skeleton}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, left: 0, right: 0 },
});
