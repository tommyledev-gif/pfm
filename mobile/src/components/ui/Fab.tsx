import { ComponentType } from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SPRING } from "@/components/motion/motion-tokens";
import { FAB_SIZE, FabButton } from "@/components/ui/FabButton";
import { IconProps } from "@/components/ui/icons/primitives";
import { PlusIcon } from "@/components/ui/Icon";
import { spacing, createStyles, useColors } from "@/lib/theme";

export { FAB_PRESS_SCALE, FAB_SIZE } from "@/components/ui/FabButton";

// BottomNav's bar height (components/shared/BottomNav.tsx PILL_HEIGHT). The
// FAB floats this far up plus the safe-area inset, so it always clears the
// nav instead of sitting on top of it.
const NAV_HEIGHT = 64;
// Pops in a beat after its screen, so it reads as arriving rather than as
// part of the layout. Built per mount: Reanimated's builders are mutable.
const FAB_ENTER_DELAY_MS = 150;
export const fabEntrance = () =>
  ZoomIn.springify().damping(SPRING.damping).stiffness(SPRING.stiffness).mass(SPRING.mass).delay(FAB_ENTER_DELAY_MS);

interface FabProps {
  onPress: () => void;
  Icon?: ComponentType<IconProps>;
  accessibilityLabel: string;
  testID?: string;
  /** Position tweaks only — e.g. `right: 0` inside a host that already pads its sides. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Bottom padding a scrolling list under a Fab needs so its last row can
 * scroll clear of both the nav and the button, instead of ending beneath them.
 */
export function useFabClearance(): number {
  return useFabBottom() + FAB_SIZE + spacing.lg;
}

/** The Fab's `bottom` offset — clear of the nav and the safe-area inset. */
export function useFabBottom(): number {
  const insets = useSafeAreaInsets();
  return NAV_HEIGHT + insets.bottom + spacing.xl;
}

/**
 * Bottom-right floating action button for a screen's primary "create" action
 * (the button's look: FabButton). Pops in when its screen mounts and dips
 * while pressed; Reduce Motion skips both (Reanimated's entrance follows the
 * OS setting, PressableScale its own).
 *
 * Render it BEFORE the screen's Drawer sheets in the tree, so an open sheet's
 * overlay paints over it rather than under it.
 */
export function Fab({ onPress, Icon = PlusIcon, accessibilityLabel, testID, style }: FabProps) {
  const colors = useColors();
  const styles = useStyles();
  const bottom = useFabBottom();
  return (
    <Animated.View entering={fabEntrance()} style={[styles.host, { bottom }, style]} pointerEvents="box-none">
      <FabButton testID={testID} accessibilityLabel={accessibilityLabel} onPress={onPress}>
        <Icon size={24} color={colors.onGreen} />
      </FabButton>
    </Animated.View>
  );
}

const useStyles = createStyles(() => ({
  // Placement lives on the host, so a caller's `style` still moves the button.
  host: { position: "absolute", right: spacing.xl },
}));
