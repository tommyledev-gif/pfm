import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { CheckIcon } from "@/components/ui/Icon";
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
 */
export function ChatModePicker({ visible, mode, onClose, onSelect }: ChatModePickerProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Swallows the press so a tap inside the card does not close it. */}
        <Pressable onPress={() => {}} style={styles.card}>
          <Text style={styles.title}>Chế độ trò chuyện</Text>

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
                style={({ pressed }) => [styles.row, active && { borderColor: meta.tint }, pressed && styles.rowPressed]}
                onPress={() => onSelect(candidate)}
              >
                <View style={[styles.iconTile, { backgroundColor: `${meta.tint}1F` }]}>
                  <Icon size={18} color={meta.tint} />
                </View>

                <View style={styles.rowText}>
                  <Text style={styles.label}>{meta.label}</Text>
                  <Text style={styles.description}>{meta.description}</Text>
                </View>

                {active ? <CheckIcon size={18} color={meta.tint} /> : null}
              </Pressable>
            );
          })}
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
  card: {
    width: "100%",
    maxWidth: 380,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.hero,
    padding: spacing.lg,
  },
  title: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.bgApp,
  },
  rowPressed: { opacity: 0.6 },
  iconTile: { width: 36, height: 36, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, gap: 2 },
  label: { ...typography.body, color: colors.textPrimary, fontWeight: "600" },
  description: { ...typography.caption, color: colors.textSecondary },
});
