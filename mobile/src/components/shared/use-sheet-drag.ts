import { useMemo, useRef, useState } from "react";
import { Animated, LayoutAnimation, LayoutChangeEvent, PanResponder } from "react-native";

// Dragged down past this share of the sheet's resting height → close.
const CLOSE_RATIO = 0.5;
// A fast downward flick closes from a shorter distance than CLOSE_RATIO,
// the way native sheets do — nobody drags a flick all the way.
const FLICK_VELOCITY = 1.2;
const FLICK_MIN_RATIO = 0.2;
// Vertical travel on the handle that counts as "expand" / "collapse" rather
// than a stray touch.
const TOGGLE_DISTANCE = 40;
const MOVE_SLOP = 4;

interface UseSheetDragOptions {
  /** The sheet's own slide transform — dragging writes straight into it. */
  translateY: Animated.Value;
  onClose: () => void;
  /** False for a sheet that is already full height (DrawerChildPanel). */
  expandable?: boolean;
}

/**
 * The drag-handle gesture for a bottom sheet.
 *
 * Drag down: the sheet follows the finger; released below half its resting
 * height it closes, otherwise it springs back. Drag up: the sheet expands to
 * its maximum height (drag down again to collapse it).
 *
 * ⚠️ Attached to the handle strip only, never the whole sheet: the body is a
 * ScrollView, and a sheet-wide responder would fight it for every vertical
 * scroll. Plain PanResponder — gesture-handler is not a dependency here.
 */
export function useSheetDrag({ translateY, onClose, expandable = true }: UseSheetDragOptions) {
  const [expanded, setExpanded] = useState(false);
  const restingHeight = useRef(0);

  // PanResponder.create runs once, so everything it reads goes through refs.
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const onSheetLayout = (event: LayoutChangeEvent) => {
    // Measured only while collapsed, so "half the original height" stays
    // anchored to the size the sheet opened at.
    if (!expandedRef.current) restingHeight.current = event.nativeEvent.layout.height;
  };

  const panHandlers = useMemo(() => {
    const springBack = () =>
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 220 }).start();

    const setExpandedAnimated = (next: boolean) => {
      if (expandedRef.current === next) return;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpanded(next);
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > MOVE_SLOP,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        // Only downward travel moves the sheet — lifting it off the bottom
        // edge would open a gap under it. Upward intent is read on release.
        translateY.setValue(Math.max(0, g.dy));
      },
      onPanResponderRelease: (_, g) => {
        const height = restingHeight.current;
        const pastHalf = height > 0 && g.dy > height * CLOSE_RATIO;
        const flicked = height > 0 && g.vy > FLICK_VELOCITY && g.dy > height * FLICK_MIN_RATIO;
        if (pastHalf || flicked) {
          // The host's own close animation continues from where the finger
          // left the sheet, so no reset here.
          onCloseRef.current();
          return;
        }
        springBack();
        if (!expandable) return;
        if (g.dy < -TOGGLE_DISTANCE) setExpandedAnimated(true);
        else if (g.dy > TOGGLE_DISTANCE) setExpandedAnimated(false);
      },
      onPanResponderTerminate: springBack,
    }).panHandlers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { expanded, panHandlers, onSheetLayout, collapse: () => setExpanded(false) };
}
