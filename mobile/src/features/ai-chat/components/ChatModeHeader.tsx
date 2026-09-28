import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { ChevronDownIcon } from "@/components/ui/Icon";
import { CHAT_MODE_META, ChatMode } from "@/features/ai-chat/chat-mode";
import { colors, radii, spacing, typography } from "@/lib/theme";

const BRAND_LOGO = require("../../../../assets/simple-budgest-logo.png");

interface ChatModeHeaderProps {
  mode: ChatMode;
  onPressMode: () => void;
}

/**
 * Fixed header banner: the app's own identity on the left, and on the right
 * the one control that says what the next message will be treated as.
 *
 * The mode control is a labelled pill (icon + short name + chevron) rather
 * than a bare icon circle: it is the first thing the eye lands on in this
 * screen, and an unlabelled glyph left the user guessing both what mode they
 * were in and that it was tappable at all. A soft ring in the mode's colour
 * gives it the "glow" that marks it as the screen's key control.
 */
export function ChatModeHeader({ mode, onPressMode }: ChatModeHeaderProps) {
  const meta = CHAT_MODE_META[mode];
  const ModeIcon = meta.icon;

  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <View style={styles.logoTile}>
          <Image source={BRAND_LOGO} style={styles.logo} resizeMode="contain" />
        </View>
        <View style={styles.brandText}>
          <Text style={styles.headerTitle}>Budgest AI</Text>
          <Text style={styles.headerSubtitle}>Trợ lý tài chính của bạn</Text>
        </View>
      </View>

      {/* The halo is its own wrapper so it stays visible on Android, where a
          coloured shadow isn't drawn. */}
      <View style={[styles.halo, { backgroundColor: `${meta.tint}14`, shadowColor: meta.tint }]}>
        <Pressable
          testID="btn-chat-mode"
          accessibilityRole="button"
          accessibilityLabel={`Chế độ: ${meta.label}. Chạm để đổi.`}
          style={({ pressed }) => [
            styles.modePill,
            { borderColor: `${meta.tint}66`, backgroundColor: `${meta.tint}1F` },
            pressed && styles.modePillPressed,
          ]}
          onPress={onPressMode}
          hitSlop={6}
        >
          <ModeIcon size={18} color={meta.tint} toColor={meta.iconToColor} />
          <Text style={[styles.modeLabel, { color: meta.tint }]} numberOfLines={1}>
            {meta.shortLabel}
          </Text>
          <ChevronDownIcon size={14} color={meta.tint} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // A banner strip: its own edge at the bottom, and clear space before the
  // thread starts, so header and conversation read as separate zones.
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: spacing.md, flexShrink: 1 },
  logoTile: {
    width: 40,
    height: 40,
    borderRadius: radii.listCard - 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: 28, height: 28 },
  brandText: { flexShrink: 1, gap: 1 },
  headerTitle: { ...typography.cardTitle, color: colors.textPrimary },
  headerSubtitle: { ...typography.tiny, color: colors.textSecondary },
  halo: {
    padding: 3,
    borderRadius: radii.pill,
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  modePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  modePillPressed: { opacity: 0.7 },
  modeLabel: { ...typography.caption, fontWeight: "700" },
});
