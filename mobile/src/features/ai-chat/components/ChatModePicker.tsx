import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { CheckCircleIcon } from "@/components/ui/Icon";
import { CHAT_MODE_META, CHAT_MODE_ORDER, ChatMode } from "@/features/ai-chat/chat-mode";
import { colors, radii, spacing, typography } from "@/lib/theme";

interface ChatModePickerProps {
  visible: boolean;
  mode: ChatMode;
  onClose: () => void;
  onSelect: (mode: ChatMode) => void;
}

/**
 * The chat screen's modes — recording, the budget wizard, analysis — listed
 * so the user picks one instead of the model guessing (see `chat-mode.ts`).
 *
 * Centred popup rather than an anchored menu, matching `AmountRevealPopup` —
 * the app has no Popover primitive and no anchor measurement, and a list of
 * three needs neither.
 *
 * Deliberately flat: plain rows on the sheet, and only the selected one gets
 * a faint tint of its own colour plus the check.
 *
 * ⚠️ No shadows / elevation on the rows. On Android an elevation shadow is
 * drawn BEHIND the view, and through a translucent tinted background it
 * shows up as a dark rectangle inside the row — which is exactly what the
 * previous "elevated card" version looked like on device.
 */
export function ChatModePicker({ visible, mode, onClose, onSelect }: ChatModePickerProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Swallows the press so a tap inside the card does not close it. */}
        <Pressable onPress={() => {}} style={styles.sheet}>
          <Text style={styles.title}>Chế độ trò chuyện</Text>

          <View style={styles.list}>
            {CHAT_MODE_ORDER.map((candidate) => {
              const meta = CHAT_MODE_META[candidate];
              const Icon = meta.icon;
              const active = candidate === mode;

              return (
                <Pressable
                  key={candidate}
                  testID={`btn-chat-mode-${candidate}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.row,
                    active && { backgroundColor: `${meta.tint}14`, borderColor: `${meta.tint}59` },
                    pressed && !active && styles.rowPressed,
                  ]}
                  onPress={() => onSelect(candidate)}
                >
                  <View style={[styles.iconTile, { backgroundColor: `${meta.tint}1A` }]}>
                    <Icon size={22} color={meta.tint} toColor={meta.iconToColor} />
                  </View>

                  <View style={styles.rowText}>
                    <Text style={styles.label}>{meta.label}</Text>
                    <Text style={styles.description} numberOfLines={2}>
                      {meta.description}
                    </Text>
                  </View>

                  {/* Always reserves its slot, so selecting a row doesn't reflow its text. */}
                  <View style={styles.checkSlot}>
                    {active ? <CheckCircleIcon size={20} color={meta.tint} checkColor={colors.onGreen} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  sheet: {
    width: "100%",
    maxWidth: 380,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.hero,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  title: { ...typography.label, color: colors.textSecondary, paddingHorizontal: spacing.sm },
  list: { gap: spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.listCard,
    // Transparent until selected, so the unselected rows are just content on
    // the sheet rather than three competing boxes.
    borderWidth: 1,
    borderColor: "transparent",
  },
  rowPressed: { backgroundColor: "rgba(255,255,255,0.04)" },
  iconTile: {
    width: 42,
    height: 42,
    borderRadius: radii.listCard - 4,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, gap: 2 },
  label: { ...typography.body, color: colors.textPrimary },
  description: { ...typography.caption, fontWeight: "500", color: colors.textSecondary },
  checkSlot: { width: 20, height: 20 },
});
