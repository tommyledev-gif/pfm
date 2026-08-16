import { StyleSheet, View } from "react-native";

import { colors } from "@/lib/theme";

interface ProgressBarProps {
  progress: number; // 0-1
  color: string;
  trackColor?: string;
  height?: number;
}

export function ProgressBar({ progress, color, trackColor = colors.trackMuted, height = 8 }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={[styles.track, { backgroundColor: trackColor, height, borderRadius: height / 2 }]}>
      <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: color, borderRadius: height / 2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: "100%", overflow: "hidden" },
  fill: { height: "100%" },
});
