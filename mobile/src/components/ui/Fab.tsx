import { ComponentType } from "react";
import { Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconProps } from "@/components/ui/icons/primitives";
import { PlusIcon } from "@/components/ui/Icon";
import { colors, radii, spacing } from "@/lib/theme";

// BottomNav's bar height (components/shared/BottomNav.tsx PILL_HEIGHT). The
// FAB floats this far up plus the safe-area inset, so it always clears the
// nav instead of sitting on top of it.
const NAV_HEIGHT = 64;
const FAB_SIZE = 56;

interface FabProps {
  onPress: () => void;
  Icon?: ComponentType<IconProps>;
  accessibilityLabel: string;
  testID?: string;
}

/**
 * Bottom-right floating action button for a screen's primary "create" action.
 *
 * Render it BEFORE the screen's Drawer sheets in the tree, so an open sheet's
 * overlay paints over it rather than under it.
 */
export function Fab({ onPress, Icon = PlusIcon, accessibilityLabel, testID }: FabProps) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.fab,
        { bottom: NAV_HEIGHT + insets.bottom + spacing.xl },
        pressed && styles.pressed,
      ]}
    >
      <Icon size={24} color={colors.onGreen} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: spacing.xl,
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
});
