import { useId } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

interface GradientFillProps {
  from: string;
  to: string;
}

/**
 * A diagonal `from` → `to` gradient filling its parent, behind the parent's
 * other children — render it first. The parent supplies the shape: give it
 * a borderRadius and `overflow: "hidden"` and the gradient takes that shape.
 * Never catches touches.
 */
export function GradientFill({ from, to }: GradientFillProps) {
  // Gradient ids must be unique on screen — a thread shows many of these at
  // once — and useId's colons are not valid inside url(#…).
  const id = `gradient-fill-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
