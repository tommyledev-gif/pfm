import { Pressable, StyleSheet, Text, View } from "react-native";

import { SparkleIcon } from "@/components/ui/Icon";
import { CHAT_MODE_META, ChatMode } from "@/features/ai-chat/chat-mode";
import { colors, radii, spacing, typography } from "@/lib/theme";

interface ChatModeHeaderProps {
  mode: ChatMode;
  onPressMode: () => void;
}

/**
 * Fixed header: the app's own title, plus the one control that says what the
 * next message will be treated as.
 *
 * The title stays optically centred — it is positioned by the row's own
 * `justifyContent`, and the mode button is taken out of flow on the right so
 * that adding it did not shift the title off-centre.
 */
export function ChatModeHeader({ mode, onPressMode }: ChatModeHeaderProps) {
  const meta = CHAT_MODE_META[mode];
  const ModeIcon = meta.icon;

  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <SparkleIcon size={20} />
        <Text style={styles.headerTitle}>Budgest AI</Text>
      </View>

      <Pressable
        testID="btn-chat-mode"
        accessibilityRole="button"
        // Icon-only, so the mode has to be said out loud for anyone not
        // reading the glyph — screen readers and the test suite both.
        accessibilityLabel={`Chế độ: ${meta.label}. Chạm để đổi.`}
        style={({ pressed }) => [
          styles.modeButton,
          { borderColor: meta.tint },
          pressed && styles.modeButtonPressed,
        ]}
        onPress={onPressMode}
      >
        <ModeIcon size={18} color={meta.tint} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerTitle: { ...typography.cardTitle, color: colors.textPrimary },
  // Out of flow so the brand keeps the centre of the row to itself. `right`
  // is set explicitly; an absolute child with neither edge pinned is laid
  // out by the parent's alignItems instead, which here would stack it on
  // top of the title.
  modeButton: {
    position: "absolute",
    right: spacing.xl,
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    borderWidth: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  modeButtonPressed: { opacity: 0.6 },
});
