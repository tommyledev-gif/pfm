import { ComponentType } from "react";
import { Animated, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

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
  progress: Animated.Value;
  /** Width of the revealed strip — this side's travel cap. */
  width: number;
  parked: boolean;
  positionStyle: StyleProp<ViewStyle>;
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

export function SwipeActionButton({ action, progress, width, parked, positionStyle }: SwipeActionButtonProps) {
  const colors = useColors();
  const styles = useStyles();
  const { Icon } = action;

  // Visible from the start of the drag, solid by the park threshold.
  const indicatorOpacity = progress.interpolate({
    inputRange: [0, PARK_THRESHOLD_RATIO],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  // The dark glyph is a second, stacked copy cross-faded over the neutral
  // one: the icon's color lands on an SVG stroke, which a plain Animated
  // value cannot drive without wrapping the icon in createAnimatedComponent.
  const armedGlyphOpacity = progress.interpolate({
    inputRange: ARMED_RANGE,
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  // A soft disc that fills with the action's colour once armed — no ring.
  const backgroundColor = progress.interpolate({
    inputRange: ARMED_RANGE,
    outputRange: [withAlpha(colors.overlayBase, 0.1), action.color],
    extrapolate: "clamp",
  });
  const scale = progress.interpolate({
    inputRange: ARMED_RANGE,
    outputRange: [1, 1.15],
    extrapolate: "clamp",
  });

  if (parked) {
    return (
      <View style={[styles.strip, { width }, positionStyle]}>
        <Pressable
          testID={action.testID}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          style={[styles.parkedButton, { backgroundColor: action.color }]}
        >
          <Icon size={18} color={colors.onGreen} />
          <Text style={styles.parkedLabel} numberOfLines={1}>
            {action.label}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={[styles.strip, { width }, positionStyle]}>
      <Animated.View
        style={[styles.indicator, { opacity: indicatorOpacity, backgroundColor, transform: [{ scale }] }]}
      >
        <Icon size={16} color={colors.textPrimary} />
        <Animated.View style={[StyleSheet.absoluteFill, styles.glyphOverlay, { opacity: armedGlyphOpacity }]}>
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
  parkedLabel: { ...typography.caption, color: colors.onGreen },
}));
