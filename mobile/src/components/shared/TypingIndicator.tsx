import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { colors, radii } from "@/lib/theme";

// AI Chat's typing indicator — "3 pulsing dots" (README).
export function TypingIndicator() {
  const values = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    const animations = values.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(value, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.3, duration: 350, useNativeDriver: true }),
          Animated.delay((2 - i) * 150),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [values]);

  return (
    <View style={styles.row}>
      {values.map((value, i) => (
        <Animated.View key={i} style={[styles.dot, { opacity: value }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 5, paddingVertical: 4 },
  dot: { width: 7, height: 7, borderRadius: radii.pill, backgroundColor: colors.textSecondary },
});
