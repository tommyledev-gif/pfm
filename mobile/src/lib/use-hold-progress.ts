import { useRef } from "react";
import { Animated } from "react-native";

// Shared by Insights' Spending legend rows and Budget cards: a 2s hold on a
// progress-bar item opens a category picker drawer, with its label text
// gradually easing toward the primary accent color while held so the user
// understands the row is holdable — this hook owns just the 0..1 progress
// value driving that color interpolation (color isn't supported on the
// native driver, hence useNativeDriver: false).
export function useHoldProgress(durationMs = 2000) {
  const progress = useRef(new Animated.Value(0)).current;

  const start = () => {
    Animated.timing(progress, { toValue: 1, duration: durationMs, useNativeDriver: false }).start();
  };

  const cancel = () => {
    Animated.timing(progress, { toValue: 0, duration: 150, useNativeDriver: false }).start();
  };

  return { progress, start, cancel };
}
