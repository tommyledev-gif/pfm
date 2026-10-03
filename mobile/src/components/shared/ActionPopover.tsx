import { ComponentType, useEffect, useRef } from "react";
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions } from "react-native";

import { IconProps } from "@/components/ui/icons/primitives";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";

export interface PopoverAction {
  Icon: ComponentType<IconProps>;
  label: string;
  onPress: () => void;
  /** Shown in the danger colour. The caller still routes it to a confirmation. */
  destructive?: boolean;
  testID?: string;
}

/** The held element's frame, in window coordinates (from measureInWindow). */
export interface PopoverAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ActionPopoverProps {
  visible: boolean;
  anchor: PopoverAnchor | null;
  /** Which edge of the anchor the menu lines up with — the side the bubble sits on. */
  align: "left" | "right";
  actions: PopoverAction[];
  onClose: () => void;
}

const MENU_WIDTH = 216;
const ROW_HEIGHT = 46;
// Space between the held element and the menu, and between the menu and the
// screen edges.
const ANCHOR_GAP = spacing.sm;
const EDGE_MARGIN = spacing.lg;
const OPEN_MS = 140;
const START_SCALE = 0.94;
const BACKDROP_ALPHA = 0.18;
// Scrim and shadow ink: black in both themes, same as every other dialog.
const SCRIM = "#000000";

/**
 * A small menu that opens next to the element that was held — below it when
 * there is room, above it otherwise — instead of a dialog in the middle of the
 * screen. A Modal underneath only so it draws over everything (nav included);
 * visually it belongs to the message.
 *
 * ⚠️ On iOS the chosen action waits for onDismiss: presenting another Modal
 * (a delete confirmation, an editor) while this one is still closing is
 * silently dropped there. Android has no onDismiss and no such problem.
 */
export function ActionPopover({ visible, anchor, align, actions, onClose }: ActionPopoverProps) {
  const colors = useColors();
  const styles = useStyles();
  const window = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const pending = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!visible) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: OPEN_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, progress]);

  const choose = (onPress: () => void) => {
    onClose();
    if (Platform.OS === "ios") pending.current = onPress;
    else onPress();
  };

  const onDismiss = () => {
    const run = pending.current;
    pending.current = null;
    run?.();
  };

  const menuHeight = actions.length * ROW_HEIGHT;
  const position = anchor ? placeMenu(anchor, align, menuHeight, window.width, window.height) : null;
  const opensUp = position?.opensUp ?? false;

  return (
    <Modal
      visible={visible && anchor !== null}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
      onDismiss={onDismiss}
    >
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(SCRIM, BACKDROP_ALPHA) }]} onPress={onClose} />
      {position ? (
        <Animated.View
          style={[
            styles.menu,
            {
              top: position.top,
              left: position.left,
              opacity: progress,
              transform: [
                // Grows out of the message's side rather than from its own centre.
                { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [opensUp ? 6 : -6, 0] }) },
                { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [START_SCALE, 1] }) },
              ],
            },
          ]}
        >
          {actions.map(({ Icon, label, onPress, destructive, testID }, index) => {
            const tint = destructive ? colors.danger : colors.textPrimary;
            return (
              <Pressable
                key={label}
                testID={testID}
                accessibilityRole="menuitem"
                onPress={() => choose(onPress)}
                style={({ pressed }) => [styles.row, index > 0 && styles.divider, pressed && styles.rowPressed]}
              >
                <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
                  {label}
                </Text>
                <Icon size={18} color={destructive ? colors.danger : colors.textSecondary} />
              </Pressable>
            );
          })}
        </Animated.View>
      ) : null}
    </Modal>
  );
}

// Below the anchor if the menu fits there, otherwise above; clamped so it never
// leaves the screen. Lined up with the anchor's own edge so it reads as
// belonging to that message.
function placeMenu(anchor: PopoverAnchor, align: "left" | "right", menuHeight: number, screenW: number, screenH: number) {
  const spaceBelow = screenH - (anchor.y + anchor.height) - EDGE_MARGIN;
  const opensUp = spaceBelow < menuHeight + ANCHOR_GAP;
  const rawTop = opensUp ? anchor.y - ANCHOR_GAP - menuHeight : anchor.y + anchor.height + ANCHOR_GAP;
  const top = Math.min(Math.max(rawTop, EDGE_MARGIN), screenH - menuHeight - EDGE_MARGIN);
  const rawLeft = align === "right" ? anchor.x + anchor.width - MENU_WIDTH : anchor.x;
  const left = Math.min(Math.max(rawLeft, EDGE_MARGIN), screenW - MENU_WIDTH - EDGE_MARGIN);
  return { top, left, opensUp };
}

const useStyles = createStyles((colors) => ({
  menu: {
    position: "absolute",
    width: MENU_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: radii.listCard - 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceBorder,
    overflow: "hidden",
    // One soft lift — enough to separate it from the dimmed thread.
    shadowColor: SCRIM,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  row: {
    height: ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceBorder },
  rowPressed: { backgroundColor: withAlpha(colors.overlayBase, 0.06) },
  label: { flex: 1, ...typography.body },
}));
