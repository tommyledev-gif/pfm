import { ComponentType, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

import { IconProps } from "@/components/ui/icons/primitives";
import { PlusIcon } from "@/components/ui/Icon";
import { FAB_SIZE, useFabBottom } from "@/components/ui/Fab";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useReduceMotion } from "@/lib/use-reduce-motion";

const OPEN_MS = 220;
// How far each action travels up from the main button. The one further
// out starts further away, so the stack reads as unfolding out of the button.
const SLIDE_PER_SLOT = 24;
// Each action sits this much further left than the one above it, so the
// stack bends around the main button like an arc instead of a straight
// column: the top action lines up with the button's right edge, the one
// just above the button ends at its center.
const ARC_STEP = FAB_SIZE / 2;
// Each action trails the one nearer the button by this share of the motion.
const STAGGER = 0.2;

export interface FabAction {
  key: string;
  label: string;
  Icon: ComponentType<IconProps>;
  onPress: () => void;
  testID?: string;
}

interface ExpandableFabProps {
  /** Stacked top to bottom, all above the main button. */
  actions: FabAction[];
  accessibilityLabel: string;
  testID?: string;
  /** Position tweaks only — e.g. `right: 0` inside a host that already pads its sides. */
  style?: StyleProp<ViewStyle>;
}

/**
 * A Fab that opens into a stack of labelled actions above it. The plus
 * turns into an × while open; tapping it again, or anywhere else in the
 * host, folds the stack back. Picking an action closes it first.
 *
 * Sits exactly where a plain Fab would (same size and bottom offset), so a
 * screen can swap one for the other without its list padding changing.
 */
export function ExpandableFab({ actions, accessibilityLabel, testID, style }: ExpandableFabProps) {
  const colors = useColors();
  const styles = useStyles();
  const bottom = useFabBottom();
  const reduceMotion = useReduceMotion();
  const [open, setOpen] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  // Restarts from wherever it currently is, so a quick double tap reverses
  // the motion instead of snapping.
  useEffect(() => {
    const toValue = open ? 1 : 0;
    if (reduceMotion) {
      progress.setValue(toValue);
      return;
    }
    Animated.timing(progress, {
      toValue,
      duration: OPEN_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, reduceMotion, progress]);

  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "45deg"] });

  return (
    <>
      {/* Catches a tap anywhere else in the host, so the stack never stays
          open behind the User's back. Transparent: a dim limited to the
          host's padded box would show hard edges. */}
      {open ? <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessible={false} /> : null}

      <View style={[styles.container, { bottom }, style]} pointerEvents="box-none">
        <View
          style={styles.actions}
          pointerEvents={open ? "box-none" : "none"}
          accessibilityElementsHidden={!open}
          importantForAccessibility={open ? "auto" : "no-hide-descendants"}
        >
          {actions.map((action, index) => {
            // 0 = the slot next to the main button.
            const slot = actions.length - 1 - index;
            const start = Math.min(slot * STAGGER, 0.6);
            const local = progress.interpolate({ inputRange: [start, 1], outputRange: [0, 1], extrapolate: "clamp" });
            const translateY = local.interpolate({ inputRange: [0, 1], outputRange: [SLIDE_PER_SLOT * (slot + 1), 0] });
            const scale = local.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
            const arcInset = ARC_STEP * index;
            return (
              <Animated.View
                key={action.key}
                style={{ marginRight: arcInset, opacity: local, transform: [{ translateY }, { scale }] }}
              >
                <Pressable
                  testID={action.testID}
                  accessibilityRole="button"
                  onPress={() => {
                    setOpen(false);
                    action.onPress();
                  }}
                  style={({ pressed }) => [styles.action, pressed && styles.pressed]}
                >
                  <action.Icon size={16} color={colors.green} />
                  <Text style={styles.actionLabel} numberOfLines={1}>
                    {action.label}
                  </Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={open ? "Đóng" : accessibilityLabel}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((prev) => !prev)}
          hitSlop={8}
          style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
        >
          <Animated.View style={{ transform: [{ rotate }] }}>
            <PlusIcon size={24} color={colors.onGreen} />
          </Animated.View>
        </Pressable>
      </View>
    </>
  );
}

const useStyles = createStyles((colors) => ({
  container: {
    position: "absolute",
    right: spacing.xl,
    alignItems: "flex-end",
    gap: spacing.md,
  },
  actions: { alignItems: "flex-end", gap: spacing.sm },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surfaceRaised,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  actionLabel: { ...typography.label, color: colors.textPrimary },
  // Same look as the plain Fab — see Fab.tsx.
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: radii.pill,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.green,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.95 }] },
}));
