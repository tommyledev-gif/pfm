import { ComponentType } from "react";
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, {
  DerivedValue,
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
} from "react-native-reanimated";

import { IconProps } from "@/components/ui/icons/primitives";
import { ARMED_TRANSITION_SPAN, PARK_THRESHOLD_RATIO } from "@/components/shared/use-swipe-actions";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";

export interface SwipeAction {
  Icon: ComponentType<IconProps>;
  /** Solid fill once armed — a different control, not a tinted resting one. */
  color: string;
  /** Shown only once the row has parked, when there is width to read it. */
  label: string;
  /** Destructive actions are routed to a confirmation by the caller. */
  destructive?: boolean;
  onPress: () => void;
  testID?: string;
}

interface SwipeActionButtonProps {
  action: SwipeAction;
  /** 0..1 travel fraction for this side, from useSwipeActions. */
  progress: DerivedValue<number>;
  /** Width of the revealed strip — this side's travel cap. */
  width: number;
  parked: boolean;
  positionStyle: StyleProp<ViewStyle>;
  /**
   * The action's colour fills the whole revealed strip, edge to edge and top
   * to bottom, as iOS Mail does — for rows in an inset group, where a small
   * pill floating in the gap read as unfinished.
   */
  fill?: boolean;
}

// The control revealed behind a swiped row.
//
// It has two appearances for one reason: while the finger is still down there
// is no decision to offer, so it is a small indicator that says "keep going".
// Once the row parks there is a decision, so it becomes a real button with a
// label and a tap target — which is the whole behavioural change this
// component exists for. Releasing used to act; now it reveals this.
// Where the indicator shifts from resting to armed styling.
const ARMED_RANGE = [PARK_THRESHOLD_RATIO, PARK_THRESHOLD_RATIO + ARMED_TRANSITION_SPAN];

export function SwipeActionButton({ action, progress, width, parked, positionStyle, fill = false }: SwipeActionButtonProps) {
  const colors = useColors();
  const styles = useStyles();
  const { Icon } = action;
  const restColor = withAlpha(colors.overlayBase, 0.1);

  // Visible from the start of the drag, solid by the park threshold; a soft
  // disc that fills with the action's colour once armed — no ring.
  const indicatorStyle = useAnimatedStyle(() => {
    const armed = interpolate(progress.value, ARMED_RANGE, [0, 1], Extrapolation.CLAMP);
    return {
      opacity: interpolate(progress.value, [0, PARK_THRESHOLD_RATIO], [0, 1], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(armed, [0, 1], [restColor, action.color]),
      transform: [{ scale: 1 + 0.15 * armed }],
    };
  });
  // The dark glyph is a second, stacked copy cross-faded over the neutral
  // one: the icon's colour lands on an SVG stroke, which an animated style
  // cannot reach.
  const armedGlyphStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, ARMED_RANGE, [0, 1], Extrapolation.CLAMP),
  }));
  // A filled strip is hidden at rest, so no sliver of colour can show at the
  // row's rounded edges before anyone swipes.
  const fillStyle = useAnimatedStyle(() => ({ opacity: progress.value > 0 ? 1 : 0 }));

  if (parked) {
    return (
      <View style={[styles.strip, { width }, positionStyle, fill && { backgroundColor: action.color }]}>
        <Pressable
          testID={action.testID}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          style={({ pressed }) =>
            fill
              ? [styles.fillButton, pressed && styles.fillPressed]
              : [styles.parkedButton, { backgroundColor: action.color }]
          }
        >
          <Icon size={18} color={colors.onGreen} />
          <Text style={styles.parkedLabel} numberOfLines={1}>
            {action.label}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (fill) {
    return (
      <Animated.View
        pointerEvents="none"
        style={[styles.strip, { width, backgroundColor: action.color }, positionStyle, fillStyle]}
      >
        <Icon size={18} color={colors.onGreen} />
      </Animated.View>
    );
  }

  return (
    <View pointerEvents="none" style={[styles.strip, { width }, positionStyle]}>
      <Animated.View style={[styles.indicator, indicatorStyle]}>
        <Icon size={16} color={colors.textPrimary} />
        <Animated.View style={[StyleSheet.absoluteFill, styles.glyphOverlay, armedGlyphStyle]}>
          <Icon size={16} color={colors.onGreen} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  strip: { position: "absolute", top: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  indicator: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  glyphOverlay: { alignItems: "center", justifyContent: "center" },
  parkedButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.listCard,
    marginHorizontal: spacing.sm,
  },
  // The whole strip is the button.
  fillButton: {
    alignSelf: "stretch",
    width: "100%",
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  fillPressed: { backgroundColor: withAlpha(colors.overlayBase, 0.12) },
  parkedLabel: { ...typography.caption, color: colors.onGreen },
}));
