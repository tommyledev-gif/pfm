import { useId } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

interface EdgeFadeProps {
  width: number;
  /** The ground behind the scrolling row — the fade dissolves into it. */
  color: string;
}

/**
 * A right-edge fade over a horizontally scrolling row, so the last visible
 * item reads as "more this way" instead of being cut off mid-word. Pair it
 * with `paddingRight: width` on the row, or the final item could never
 * scroll fully clear of the fade. Never catches touches.
 */
export function EdgeFade({ width, color }: EdgeFadeProps) {
  // Gradient ids must be unique on screen — several rows can be visible at
  // once — and useId's colons are not valid inside url(#…).
  const id = `edge-fade-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <View pointerEvents="none" style={[styles.fade, { width }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={color} stopOpacity={0} />
            <Stop offset="1" stopColor={color} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fade: { position: "absolute", top: 0, bottom: 0, right: 0 },
});
