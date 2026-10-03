import { Animated, StyleSheet, View } from "react-native";

import { useColors } from "@/lib/theme";
import { useEntryAnimation } from "@/lib/use-entry-animation";

interface ProgressBarProps {
  progress: number; // 0-1
  color: string;
  trackColor?: string;
  height?: number;
}

export function ProgressBar({ progress, color, trackColor, height = 8 }: ProgressBarProps) {
  const colors = useColors();
  const clamped = Math.max(0, Math.min(1, progress));
  // Grows from empty to its value on first render (scaled from the left edge).
  const grow = useEntryAnimation();
  return (
    <View style={[styles.track, { backgroundColor: trackColor ?? colors.trackMuted, height, borderRadius: height / 2 }]}>
      <Animated.View
        style={[
          styles.fill,
          { width: `${clamped * 100}%`, backgroundColor: color, borderRadius: height / 2 },
          { transform: [{ scaleX: grow }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: "100%", overflow: "hidden" },
  fill: { height: "100%", transformOrigin: "left" },
});
