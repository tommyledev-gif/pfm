import { useRef } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";

import { SwipeAction } from "@/components/shared/SwipeActionButton";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";

interface QuickActionsPopupProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Same shape as the swipe actions, so a long-press menu and a swipe on
   *  the same item offer exactly the same choices, in the same colors. */
  actions: SwipeAction[];
}

// Centered popup of the actions a long-press offers — the tap-and-hold
// counterpart of a row's swipe-revealed buttons. Closes itself before running
// the chosen action, so an action that opens another modal never stacks on
// top of this one.
//
// ⚠️ On iOS the action waits for onDismiss: presenting a second <Modal> (the
// delete ConfirmDialog) while this one is still animating out is silently
// dropped there. Android has no onDismiss and no such problem.
export function QuickActionsPopup({ visible, onClose, title, actions }: QuickActionsPopupProps) {
  const colors = useColors();
  const styles = useStyles();
  const pending = useRef<(() => void) | null>(null);

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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onDismiss={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.card}>
          {title ? (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          <View style={styles.actions}>
            {actions.map(({ Icon, color, label, testID, onPress }) => (
              <Pressable
                key={label}
                testID={testID}
                accessibilityRole="button"
                onPress={() => choose(onPress)}
                style={({ pressed }) => [styles.action, { backgroundColor: color }, pressed && styles.pressed]}
              >
                <Icon size={18} color={colors.onGreen} />
                <Text style={styles.actionLabel}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = createStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  card: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.hero,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { ...typography.body, color: colors.textPrimary, textAlign: "center" },
  actions: { flexDirection: "row", gap: spacing.sm },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: 14,
    borderRadius: radii.pill,
  },
  pressed: { opacity: 0.85 },
  actionLabel: { ...typography.body, fontWeight: "700", color: colors.onGreen },
}));
