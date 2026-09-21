import { ComponentType } from "react";
import { Animated, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

import { IconProps } from "@/components/ui/icons/primitives";
import { FADE_LEAD, SWIPE_ARM_RATIO } from "@/components/shared/use-swipe-actions";
import { colors, radii, spacing, typography } from "@/lib/theme";

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
export function SwipeActionButton({ action, progress, width, parked, positionStyle }: SwipeActionButtonProps) {
  const { Icon } = action;

  const indicatorOpacity = progress.interpolate({
    inputRange: [SWIPE_ARM_RATIO - FADE_LEAD, SWIPE_ARM_RATIO],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  // The dark glyph is a second, stacked copy cross-faded over the neutral
  // one: the icon's color lands on an SVG stroke, which a plain Animated
  // value cannot drive without wrapping the icon in createAnimatedComponent.
  const armedGlyphOpacity = progress.interpolate({
    inputRange: [SWIPE_ARM_RATIO, 1],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const backgroundColor = progress.interpolate({
    inputRange: [SWIPE_ARM_RATIO, 1],
    outputRange: [colors.surface, action.color],
    extrapolate: "clamp",
  });
  const borderColor = progress.interpolate({
    inputRange: [SWIPE_ARM_RATIO, 1],
    outputRange: [colors.surfaceBorder, action.color],
    extrapolate: "clamp",
  });
  const scale = progress.interpolate({
    inputRange: [SWIPE_ARM_RATIO, 1],
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
        style={[styles.indicator, { opacity: indicatorOpacity, backgroundColor, borderColor, transform: [{ scale }] }]}
      >
        <Icon size={16} color={colors.textPrimary} />
        <Animated.View style={[StyleSheet.absoluteFill, styles.glyphOverlay, { opacity: armedGlyphOpacity }]}>
          <Icon size={16} color={colors.onGreen} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { position: "absolute", top: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  indicator: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    borderWidth: 1.5,
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
});
