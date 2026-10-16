import { useId } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

interface EdgeFadeProps {
  /** How far the fade reaches in from its edge. */
  width: number;
  /** The ground behind the scrolling content — the fade dissolves into it. */
  color: string;
  /** Right for a horizontal row (the default), bottom for a vertical list. */
  edge?: "right" | "bottom";
}

/**
 * An edge fade over scrolling content, so the last visible item reads as
 * "more this way" instead of being cut off mid-word. Pair it with padding on
 * that side of the content, or the final item could never scroll fully clear
 * of the fade. Never catches touches.
 */
export function EdgeFade({ width, color, edge = "right" }: EdgeFadeProps) {
  // Gradient ids must be unique on screen — several rows can be visible at
  // once — and useId's colons are not valid inside url(#…).
  const id = `edge-fade-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const bottom = edge === "bottom";
  return (
    <View pointerEvents="none" style={bottom ? [styles.bottom, { height: width }] : [styles.right, { width }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2={bottom ? "0" : "1"} y2={bottom ? "1" : "0"}>
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
  right: { position: "absolute", top: 0, bottom: 0, right: 0 },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0 },
});
