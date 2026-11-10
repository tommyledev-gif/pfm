import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

interface GradientFillProps {
  from: string;
  to: string;
}

/**
 * A diagonal `from` → `to` gradient filling its parent, behind the parent's
 * other children — render it first. The parent supplies the shape: give it
 * a borderRadius and `overflow: "hidden"` and the gradient takes that shape.
 * Never catches touches.
 *
 * ⚠️ RN's own gradient, not react-native-svg (2026-11-10). On Android an SVG
 * is rendered into a bitmap the size of the view and uploaded to the GPU as
 * a texture: every user bubble in the chat was its own ~800×240px texture,
 * more than the GPU's texture cache holds for a thread, so they were drawn
 * and uploaded again on every switch to the tab and on scroll (emulator
 * trace: hundreds of uploads per switch, 150-270ms frames). This is drawn
 * with a shader, no bitmap.
 */
export function GradientFill({ from, to }: GradientFillProps) {
  const style = useMemo(
    () => [StyleSheet.absoluteFill, { experimental_backgroundImage: `linear-gradient(to bottom right, ${from}, ${to})` }],
    [from, to],
  );
  return <View pointerEvents="none" style={style} />;
}
