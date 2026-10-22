import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, LayoutAnimation, LayoutChangeEvent, PanResponder } from "react-native";

// Dragged down past this share of the sheet's resting height → close.
const CLOSE_RATIO = 0.5;
// A fast downward flick closes from a shorter distance than CLOSE_RATIO,
// the way native sheets do — nobody drags a flick all the way.
const FLICK_VELOCITY = 1.2;
const FLICK_MIN_RATIO = 0.2;
// Vertical travel (or speed) on the handle that counts as "expand" /
// "collapse" rather than a stray touch.
const TOGGLE_DISTANCE = 40;
const TOGGLE_VELOCITY = 0.5;
const MOVE_SLOP = 4;
// Pulling up past the sheet's top gives with resistance, up to this far, so
// the drag feels attached before the release expands it.
const RUBBER_MAX = 36;
const rubber = (distance: number) => RUBBER_MAX * (1 - Math.exp(-distance / (RUBBER_MAX * 3)));

// The height change between resting and full: a soft spring, so the sheet
// settles into the new height rather than snapping to it.
const RESIZE_ANIMATION = {
  duration: 320,
  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  update: { type: LayoutAnimation.Types.spring, springDamping: 0.86 },
};

interface UseSheetDragOptions {
  /** The sheet's own slide transform — dragging writes straight into it. */
  translateY: Animated.Value;
  onClose: () => void;
}

/**
 * The drag-handle gesture for a bottom sheet, with two heights:
 *
 * - Resting: drag up (or tap the handle) → the sheet grows to the full
 *   screen. Drag down past half its height, or flick down → it closes.
 * - Full screen: drag down (or tap the handle) → back to the resting height,
 *   never straight to closed; a second drag down then closes it as usual.
 *
 * The sheet follows the finger down, and gives a little with resistance on
 * the way up, so it feels held throughout; the height change itself happens
 * on release, as a layout spring.
 *
 * ⚠️ Attached to the handle strip only, never the whole sheet: the body is a
 * ScrollView, and a sheet-wide responder would fight it for every vertical
 * scroll. Plain PanResponder — gesture-handler is not a dependency here.
 */
export function useSheetDrag({ translateY, onClose }: UseSheetDragOptions) {
  const [expanded, setExpanded] = useState(false);
  const restingHeight = useRef(0);
  // 0 resting → 1 full screen, for the handle's line-to-chevron morph.
  const progress = useRef(new Animated.Value(0)).current;

  // PanResponder.create runs once, so everything it reads goes through refs.
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    Animated.timing(progress, { toValue: expanded ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  }, [expanded, progress]);

  const onSheetLayout = (event: LayoutChangeEvent) => {
    // Measured only while resting, so "half the original height" stays
    // anchored to the size the sheet opened at.
    if (!expandedRef.current) restingHeight.current = event.nativeEvent.layout.height;
  };

  const panHandlers = useMemo(() => {
    const springBack = () =>
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 240 }).start();

    const setExpandedAnimated = (next: boolean) => {
      if (expandedRef.current === next) return;
      LayoutAnimation.configureNext(RESIZE_ANIMATION);
      setExpanded(next);
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > MOVE_SLOP,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        // Down follows the finger 1:1; up gives with resistance only — a
        // skirt under the sheet (Drawer) covers the gap it opens at the foot.
        translateY.setValue(g.dy >= 0 ? g.dy : -rubber(-g.dy));
      },
      onPanResponderRelease: (_, g) => {
        // A tap on the handle toggles the height.
        if (Math.abs(g.dy) < MOVE_SLOP && Math.abs(g.dx) < MOVE_SLOP) {
          springBack();
          setExpandedAnimated(!expandedRef.current);
          return;
        }
        const goingDown = g.dy > TOGGLE_DISTANCE || g.vy > TOGGLE_VELOCITY;
        const goingUp = g.dy < -TOGGLE_DISTANCE || g.vy < -TOGGLE_VELOCITY;

        if (expandedRef.current) {
          // From full screen, down only ever steps back to resting.
          springBack();
          if (goingDown) setExpandedAnimated(false);
          return;
        }

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
        if (goingUp) setExpandedAnimated(true);
      },
      onPanResponderTerminate: springBack,
    }).panHandlers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { expanded, progress, panHandlers, onSheetLayout, collapse: () => setExpanded(false) };
}
