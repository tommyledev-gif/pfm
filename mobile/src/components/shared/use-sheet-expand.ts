import { useEffect, useRef, useState } from "react";
import { Animated, Easing, LayoutChangeEvent } from "react-native";

import { runNativeAnimation } from "@/lib/run-native-animation";

const EXPAND = { duration: 320, easing: Easing.bezier(0.2, 0, 0, 1) };

interface Offsets {
  /** The surface's background (its rounded top edge). */
  bg: number;
  /** The handle and the scrolling body. */
  content: number;
}
const ZERO: Offsets = { bg: 0, content: 0 };

interface UseSheetExpandOptions {
  /** useSheetDrag's state: the sheet is (heading to) full screen. */
  expanded: boolean;
  /** The height the full-screen sheet takes: the backdrop above the keyboard. */
  available: number;
  topInset: number;
  cornerRadius: number;
  /**
   * The whole sheet's slide (useDrawerMotion's translateY), left where the
   * finger let go by a toggling release (useSheetDrag): brought home on the
   * move's own curve, so the drag carries straight into it.
   */
  lift: Animated.Value;
}

/**
 * The resting ⇄ full-screen move of a Drawer sheet, with no layout animated.
 *
 * ⚠️ Twice it was a layout animation, and both shook: a style swap left to
 * the layout transition (the content took its full-screen layout at once
 * while the frame glided), then a Reanimated minHeight (measured on the
 * emulator 2026-11-11: the height landed in 2-3 frames, Reanimated's layout
 * frames being dropped while React commits the toggle, and the status bar
 * padding caught up ~250ms later).
 *
 * Now the sheet swaps to its full-screen layout in ONE commit that also
 * carries a fixed offset (`shift`) putting everything back where the resting
 * sheet drew it, so that frame looks unchanged. Then only transforms move,
 * on the native driver: the background up to the top edge, the handle and
 * body up under the status bar. The footer stays pinned at the bottom (it
 * is opaque, drawn over the body's lower part while the body is lowered).
 * Collapsing runs the same in reverse and swaps the layout back at the end.
 *
 * A layer's position is `shift` (a plain transform on a plain View, committed
 * with the layout it compensates) + its native value (on its own Animated
 * view). Each only ever changes on its own channel: the layout swap moves
 * `shift`, the animation moves the value. Neither is reset behind the
 * other's back, so the two can never land on different frames.
 */
export function useSheetExpand({ expanded, available, topInset, cornerRadius, lift }: UseSheetExpandOptions) {
  // The full-screen layout, from the start of an expand to the end of a collapse.
  const [fill, setFill] = useState(false);
  // Drawer's own height glide (SHEET_RESIZE) stays off for the commit that
  // swaps back to the resting layout and is cleared one after, so it never
  // animates the swap itself. (Going up it is already off: `expanded` is
  // true in the commit before the swap, and Drawer reads that too.)
  const [hold, setHold] = useState(false);
  const [shift, setShift] = useState<Offsets>(ZERO);
  // Re-renders the layers once each move is at rest, so the props React holds
  // for them are what the native driver drew (a keyboard LayoutAnimation
  // re-sends them: see useNavBallMotion's `settled`).
  const [, setRestTick] = useState(0);
  // ⚠️ Dragged down from full screen, the full-screen look eases back into
  // the resting one as the finger nears the resting height (`toward`, 0 → 1):
  // the gap under the status bar closes and the background's top edge comes
  // back down to the handle. Without it the body hung a status bar's height
  // under the edge, and the release moved them in opposite directions (the
  // body up, the edge down: emulator, 2026-11-11). `span` and the gains are
  // native values set only while the sheet sits still, so the nodes are
  // built once (a new node on a native-driven view drops it for a frame).
  const [layers] = useState(() => {
    const bg = new Animated.Value(0);
    const content = new Animated.Value(0);
    const span = new Animated.Value(1);
    const bgGain = new Animated.Value(0);
    const contentGain = new Animated.Value(0);
    const toward = Animated.divide(lift, span).interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" });
    return {
      bg,
      content,
      span,
      bgGain,
      contentGain,
      bgStyle: { transform: [{ translateY: Animated.add(bg, Animated.multiply(toward, bgGain)) }] },
      contentStyle: { transform: [{ translateY: Animated.add(content, Animated.multiply(toward, contentGain)) }] },
    };
  });
  const setDragEase = (on: boolean, span = 1) => {
    layers.span.setValue(Math.max(1, span));
    // Full screen the background starts `cornerRadius` above the edge.
    layers.bgGain.setValue(on ? cornerRadius : 0);
    layers.contentGain.setValue(on ? -topInset : 0);
  };
  // Where each native value is (or is headed).
  const inner = useRef<Offsets>(ZERO);
  const restingHeight = useRef(0);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const lastExpanded = useRef(expanded);
  const shiftRef = useRef(shift);
  shiftRef.current = shift;

  // Where the resting sheet's background and handle sit, seen from the
  // full-screen layout (background drawn from `-cornerRadius`, content
  // under the status bar padding).
  const restingOffsets = (): Offsets => {
    const top = Math.max(0, available - restingHeight.current);
    return { bg: top + cornerRadius, content: top - topInset };
  };

  const animateTo = (target: Offsets, onRest?: () => void) => {
    inner.current = target;
    let running = 2;
    const restOne = () => {
      running -= 1;
      if (running > 0) return;
      setRestTick((n) => n + 1);
      onRest?.();
    };
    const run = (value: Animated.Value, to: number) =>
      runNativeAnimation(value, to, Animated.timing(value, { toValue: to, ...EXPAND, useNativeDriver: true }), restOne);
    run(layers.bg, target.bg);
    run(layers.content, target.content);
    // Through runNativeAnimation too: RN's own end sync would re-render the
    // layers reading `lift` with their other values' JS side (one-value-per-
    // view, useNavBallMotion), which may not have caught up yet.
    runNativeAnimation(lift, 0, Animated.timing(lift, { toValue: 0, ...EXPAND, useNativeDriver: true }));
  };
  // Full screen and still: from here a drag down eases back toward resting.
  const landFull = () => setDragEase(true, available - restingHeight.current);

  // Visible position = shift + inner, so this target lands on `look`.
  const innerFor = (look: Offsets): Offsets => ({
    bg: look.bg - shiftRef.current.bg,
    content: look.content - shiftRef.current.content,
  });

  useEffect(() => {
    if (lastExpanded.current === expanded) return;
    lastExpanded.current = expanded;
    if (expanded) {
      // Already in the full-screen layout (a collapse cut short): back up.
      if (fill) {
        animateTo(innerFor(ZERO), landFull);
        return;
      }
      // The full-screen layout + the shift that keeps the resting look,
      // in one commit. The move starts once that has landed.
      const resting = restingOffsets();
      setShift({ bg: resting.bg - inner.current.bg, content: resting.content - inner.current.content });
      setFill(true);
      return;
    }
    if (!fill) return;
    const resting = restingOffsets();
    animateTo(innerFor(resting), () => {
      // Drawn exactly as the resting sheet: hand back to its layout, with
      // the shift that keeps every layer where it is now. `lift` is at 0
      // here, so dropping the drag ease moves nothing.
      setDragEase(false);
      setHold(true);
      setShift({ bg: -inner.current.bg, content: -inner.current.content });
      setFill(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  useEffect(() => {
    if (fill && expandedRef.current) animateTo(innerFor(ZERO), landFull);
    else if (!fill && hold) setHold(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fill]);

  /** The sheet surface's onLayout: the resting height, measured at rest only. */
  const onSurfaceLayout = (event: LayoutChangeEvent) => {
    if (!fill && !hold && !expandedRef.current) restingHeight.current = event.nativeEvent.layout.height;
  };

  /**
   * Straight back to the resting layout, nothing animated: for a sheet kept
   * mounted (Drawer's keepMounted) once its close has taken it off screen.
   * Call it with useSheetDrag's collapse, so the next open is at rest.
   */
  const reset = () => {
    lastExpanded.current = false;
    layers.bg.setValue(0);
    layers.content.setValue(0);
    inner.current = ZERO;
    setDragEase(false);
    setShift(ZERO);
    setFill(false);
    setHold(false);
  };

  return {
    fill,
    /** SHEET_RESIZE must stay off: a layout swap is on its way or just landed. */
    holding: hold || fill || expanded,
    reset,
    shift,
    bgLayerStyle: layers.bgStyle,
    contentLayerStyle: layers.contentStyle,
    onSurfaceLayout,
  };
}
