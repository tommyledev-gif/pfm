import { useRef, useState } from "react";
import { Animated, Dimensions, PanResponder, StyleSheet } from "react-native";
import { useSafeAreaInsets, type EdgeInsets } from "react-native-safe-area-context";

import { colors, radii } from "@/lib/theme";
import { DebugLogViewer } from "@/components/debug/DebugLogViewer";
import { useUiPrefsStore } from "@/stores/ui-prefs-store";

const BUBBLE_SIZE = 48;
const DEFAULT_BOTTOM_OFFSET = 140; // clears the bottom nav bar
const DEFAULT_SIDE_OFFSET = 16;
// Under this many pixels of total movement, a touch counts as a tap (opens
// the viewer); at or beyond it, it counts as a drag (repositions only) —
// specs/mobile-debug-console/spec.md Edge Case #6.
const TAP_THRESHOLD_PX = 10;

function defaultPosition(insets: EdgeInsets): { x: number; y: number } {
  const window = Dimensions.get("window");
  return {
    x: window.width - BUBBLE_SIZE - DEFAULT_SIDE_OFFSET - insets.right,
    y: window.height - BUBBLE_SIZE - DEFAULT_BOTTOM_OFFSET - insets.bottom,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(max, min));
}

// Draggable-anywhere floating control, mounted once in app/_layout.tsx
// above the Stack so it survives every screen/route (spec.md decision #4).
// Uses only React Native core's PanResponder/Animated — no
// react-native-gesture-handler/reanimated dependency (spec.md decision #2).
export function DebugBubble() {
  const insets = useSafeAreaInsets();
  const [viewerOpen, setViewerOpen] = useState(false);
  const bubbleVisible = useUiPrefsStore((s) => s.debugBubbleVisible);

  const position = useRef(defaultPosition(insets));
  const pan = useRef(new Animated.ValueXY(position.current)).current;
  const dragDistance = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragDistance.current = 0;
        pan.setOffset(position.current);
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_evt, gesture) => {
        dragDistance.current = Math.abs(gesture.dx) + Math.abs(gesture.dy);
        pan.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_evt, gesture) => {
        pan.flattenOffset();

        const window = Dimensions.get("window");
        const rawX = position.current.x + gesture.dx;
        const rawY = position.current.y + gesture.dy;
        // Clamp to the safe area so a drag can never leave the bubble
        // unreachable off-screen or under a notch (Edge Case #2).
        const clampedX = clamp(rawX, insets.left, window.width - BUBBLE_SIZE - insets.right);
        const clampedY = clamp(rawY, insets.top, window.height - BUBBLE_SIZE - insets.bottom);
        position.current = { x: clampedX, y: clampedY };
        pan.setValue(position.current);

        if (dragDistance.current < TAP_THRESHOLD_PX) {
          setViewerOpen(true);
        }
      },
    }),
  ).current;

  // Hidden by the Developer screen's toggle — logging (axios.ts, global-
  // error-logger.ts, NavigationLogger) keeps running regardless, see this
  // component's own doc comment above and ui-prefs-store.ts's field comment.
  if (!bubbleVisible) return null;

  return (
    <>
      <Animated.View
        testID="debug-bubble"
        style={[styles.bubble, { transform: pan.getTranslateTransform() }]}
        {...panResponder.panHandlers}
      />
      <DebugLogViewer visible={viewerOpen} onClose={() => setViewerOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: "absolute",
    top: 0,
    left: 0,
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: radii.pill,
    backgroundColor: colors.lavender,
    opacity: 0.85,
    zIndex: 9999,
    elevation: 9999,
  },
});
