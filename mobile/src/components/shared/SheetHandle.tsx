import { useMemo } from "react";
import { Animated, GestureResponderHandlers, View } from "react-native";
import { useTranslation } from "react-i18next";

import { withAlpha } from "@/lib/color";
import { createStyles } from "@/lib/theme";

const HALF_WIDTH = 21;
const BAR_HEIGHT = 4;
// How far each half tips when the sheet is full screen: the flat line bends
// into a chevron pointing down — "drag down from here".
const CHEVRON_DEG = 16;

interface SheetHandleProps {
  panHandlers: GestureResponderHandlers;
  /** 0 resting → 1 full screen (use-sheet-drag). */
  progress: Animated.Value;
  expanded: boolean;
}

/**
 * The grab bar at the top of every bottom sheet — tells the user the sheet
 * can be dragged, and is the only place the drag gesture listens (see
 * use-sheet-drag). The strip is much taller than the visible bar so it is an
 * easy target for a thumb.
 *
 * Drawn as two halves meeting in the middle: a flat line while the sheet
 * rests, bending into a down chevron once it fills the screen, the way iOS
 * marks a sheet that drags down to a smaller size.
 */
export function SheetHandle({ panHandlers, progress, expanded }: SheetHandleProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const tilt = useMemo(
    () => ({
      left: progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${CHEVRON_DEG}deg`] }),
      right: progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `-${CHEVRON_DEG}deg`] }),
    }),
    [progress],
  );
  return (
    <View
      style={styles.strip}
      {...panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={expanded ? t("ui.sheetHandle.collapse") : t("ui.sheetHandle.expand")}
      hitSlop={8}
    >
      <View style={styles.bar}>
        <Animated.View style={[styles.half, styles.leftHalf, { transform: [{ rotate: tilt.left }] }]} />
        <Animated.View style={[styles.half, styles.rightHalf, { transform: [{ rotate: tilt.right }] }]} />
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  strip: { width: "100%", alignItems: "center", paddingTop: 10, paddingBottom: 6 },
  bar: { flexDirection: "row", height: BAR_HEIGHT + 6, alignItems: "center" },
  half: {
    width: HALF_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    backgroundColor: withAlpha(colors.overlayBase, 0.28),
  },
  // Each half pivots on the end that meets the other, so the joint stays put.
  // Square inner ends: two rounded caps meeting pinched a notch into the
  // line, and overlapping them doubled the translucent grey at the joint.
  leftHalf: { transformOrigin: "right center", borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  rightHalf: { transformOrigin: "left center", borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
}));
