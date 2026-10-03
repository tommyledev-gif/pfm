import { useEffect, useMemo, useRef } from "react";
import { Animated, PanResponder, Pressable, View } from "react-native";

import { createStyles } from "@/lib/theme";

export const WHEEL_ITEM_HEIGHT = 44;
// Rows visible at once — the selected one plus two either side.
export const WHEEL_VISIBLE_ROWS = 5;
const SIDE_ROWS = (WHEEL_VISIBLE_ROWS - 1) / 2;

// Vertical travel before a touch counts as a drag rather than a tap.
const DRAG_SLOP = 4;
// How far a fling carries past the release point: release velocity (px/ms)
// times this many ms of imagined coasting.
const FLING_COAST_MS = 220;
// Dragging past either end moves the wheel at this fraction of the finger.
const OVERSCROLL_RESISTANCE = 0.35;

interface WheelColumnProps {
  items: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  testID?: string;
}

/**
 * One column of an iOS-style wheel picker: the row in the middle is large and
 * bold, the rows around it shrink and fade with distance. Drag or fling it to
 * spin; tap any visible row to jump straight to it.
 *
 * Driven by its own PanResponder rather than a ScrollView, so a tap on any
 * row can select it and a fling settles exactly on a row.
 *
 * ⚠️ Must not be placed inside a vertical ScrollView: on Android the outer
 * one starts scrolling natively before JS can claim the touch, and it wins a
 * share of the drags no matter what this column does. That is why
 * MonthYearWheelSheet hosts it in its own <Modal> window.
 *
 * Every visual — position, per-row size and fade — hangs off one Animated
 * value on the native driver, so spinning costs no React renders at all;
 * `onChange` fires once, when the wheel settles.
 */
export function WheelColumn({ items, selectedIndex, onChange, testID }: WheelColumnProps) {
  const styles = useStyles();
  // Offset of the list in px: `index * WHEEL_ITEM_HEIGHT` puts that row in the middle.
  const offset = useRef(new Animated.Value(selectedIndex * WHEEL_ITEM_HEIGHT)).current;
  const current = useRef(selectedIndex * WHEEL_ITEM_HEIGHT);
  const reported = useRef(selectedIndex);

  // PanResponder is created once, so what it reads goes through refs.
  const countRef = useRef(items.length);
  countRef.current = items.length;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const id = offset.addListener(({ value }) => {
      current.current = value;
    });
    return () => offset.removeListener(id);
  }, [offset]);

  // Follow a selection changed from outside, without animating.
  useEffect(() => {
    if (selectedIndex === reported.current) return;
    reported.current = selectedIndex;
    offset.setValue(selectedIndex * WHEEL_ITEM_HEIGHT);
  }, [selectedIndex, offset]);

  const settleOn = (index: number) => {
    const clamped = Math.max(0, Math.min(countRef.current - 1, index));
    Animated.spring(offset, {
      toValue: clamped * WHEEL_ITEM_HEIGHT,
      useNativeDriver: true,
      tension: 120,
      friction: 16,
    }).start();
    if (clamped !== reported.current) {
      reported.current = clamped;
      onChangeRef.current(clamped);
    }
  };
  const settleOnRef = useRef(settleOn);
  settleOnRef.current = settleOn;

  const panResponder = useMemo(() => {
    let start = 0;
    const max = () => (countRef.current - 1) * WHEEL_ITEM_HEIGHT;
    const isVerticalDrag = (dx: number, dy: number) => Math.abs(dy) > DRAG_SLOP && Math.abs(dy) > Math.abs(dx);
    return PanResponder.create({
      // Taps fall through to the rows; only real vertical movement is claimed.
      onMoveShouldSetPanResponder: (_, g) => isVerticalDrag(g.dx, g.dy),
      // Capture phase too, so a drag that starts on a row's Pressable still
      // becomes a spin instead of staying a (cancelled) press.
      onMoveShouldSetPanResponderCapture: (_, g) => isVerticalDrag(g.dx, g.dy),
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        start = current.current;
        // Catching a wheel that is still settling: its native position can be
        // a frame ahead of the JS listener, so start from where it really
        // stopped.
        offset.stopAnimation((value) => {
          start = value;
          current.current = value;
        });
      },
      onPanResponderMove: (_, g) => {
        let next = start - g.dy;
        if (next < 0) next *= OVERSCROLL_RESISTANCE;
        else if (next > max()) next = max() + (next - max()) * OVERSCROLL_RESISTANCE;
        offset.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        // Project the fling forward, then land on the nearest row to that.
        const projected = current.current - g.vy * FLING_COAST_MS;
        settleOnRef.current(Math.round(projected / WHEEL_ITEM_HEIGHT));
      },
      onPanResponderTerminate: () => settleOnRef.current(Math.round(current.current / WHEEL_ITEM_HEIGHT)),
    });
  }, [offset]);

  const translateY = useMemo(() => Animated.multiply(offset, -1), [offset]);
  const range = [-2, -1, 0, 1, 2];

  return (
    <View
      style={styles.column}
      testID={testID}
      {...panResponder.panHandlers}
    >
      <Animated.View style={[styles.content, { transform: [{ translateY }] }]}>
        {items.map((label, index) => {
          // How many rows this one is from the middle: 0 when centred.
          const distance = Animated.divide(Animated.subtract(offset, index * WHEEL_ITEM_HEIGHT), WHEEL_ITEM_HEIGHT);
          return (
            <Pressable
              key={label}
              // Tapping any visible row selects it.
              onPress={() => settleOn(index)}
              style={styles.row}
              accessibilityRole="button"
              accessibilityState={{ selected: index === selectedIndex }}
            >
              <Animated.Text
                style={[
                  styles.item,
                  {
                    opacity: distance.interpolate({
                      inputRange: range,
                      outputRange: [0.22, 0.5, 1, 0.5, 0.22],
                      extrapolate: "clamp",
                    }),
                    transform: [
                      {
                        scale: distance.interpolate({
                          inputRange: range,
                          outputRange: [0.5, 0.6, 1, 0.6, 0.5],
                          extrapolate: "clamp",
                        }),
                      },
                    ],
                  },
                ]}
                numberOfLines={1}
              >
                {label}
              </Animated.Text>
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  // Clips the rows moved out of the window.
  column: { flex: 1, height: WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ROWS, overflow: "hidden" },
  // Blank space above the first row, so row 0 can sit in the middle.
  content: { paddingTop: WHEEL_ITEM_HEIGHT * SIDE_ROWS },
  row: { height: WHEEL_ITEM_HEIGHT, justifyContent: "center" },
  item: {
    textAlign: "center",
    // Drawn at the centred size; the rows around it are scaled down from it.
    fontSize: 32,
    fontWeight: "800",
    color: colors.textPrimary,
  },
}));
