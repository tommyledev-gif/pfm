import { memo, useEffect, useRef } from "react";
import { Image, Pressable, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { entrance } from "@/components/motion/motion-tokens";
import { useHintTooltip } from "@/components/shared/use-hint-tooltip";
import { ChevronDownIcon, SearchIcon } from "@/components/ui/Icon";
import { CHAT_MODE_META, ChatMode } from "@/features/ai-chat/chat-mode";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";

const BRAND_LOGO = require("../../../../assets/simple-budgest-logo.png");

interface ChatModeHeaderProps {
  mode: ChatMode;
  onPressMode: () => void;
  /** Opens the message search (ChatSearchBar takes this header's place). */
  onPressSearch: () => void;
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
 *
 * Switching mode fades the pill's new icon and name in (keyed by mode), in
 * step with ChatModeBackdrop's wash; the first render just shows it.
 */
export const ChatModeHeader = memo(function ChatModeHeader({ mode, onPressMode, onPressSearch }: ChatModeHeaderProps) {
  const styles = useStyles();
  const colors = useColors();
  const searchHint = useHintTooltip("Tìm tin nhắn");
  const meta = CHAT_MODE_META[mode];
  const ModeIcon = meta.icon;
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);

  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <View style={styles.logoTile}>
          <Image source={BRAND_LOGO} style={styles.logo} resizeMode="contain" />
        </View>
        <View style={styles.brandText}>
          {/* One line each: with the search button beside the mode pill, a
              narrow phone wrapped them and the header grew a line. */}
          <Text style={styles.headerTitle} numberOfLines={1}>
            Budgest AI
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            Trợ lý tài chính của bạn
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        {/* A plain round icon button, like the Transactions header's: the
            mode pill stays the one control that glows. */}
        <Pressable
          testID="btn-chat-search"
          accessibilityRole="button"
          accessibilityLabel="Tìm tin nhắn"
          onPress={onPressSearch}
          {...searchHint}
          hitSlop={4}
          style={({ pressed }) => [styles.searchButton, pressed && styles.modePillPressed]}
        >
          <SearchIcon size={18} color={colors.textSecondary} />
        </Pressable>

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
            <Animated.View
              key={mode}
              entering={mounted.current ? entrance("fade") : undefined}
              style={styles.modeContent}
            >
              <ModeIcon size={18} color={meta.tint} toColor={meta.iconToColor} />
              <Text style={[styles.modeLabel, { color: meta.tint }]} numberOfLines={1}>
                {meta.shortLabel}
              </Text>
              <ChevronDownIcon size={14} color={meta.tint} />
            </Animated.View>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const useStyles = createStyles((colors) => ({
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
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  searchButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
  },
  halo: {
    padding: 3,
    borderRadius: radii.pill,
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  modePill: {
    paddingVertical: 7,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  modeContent: { flexDirection: "row", alignItems: "center", gap: 6 },
  modePillPressed: { opacity: 0.7 },
  modeLabel: { ...typography.caption, fontWeight: "700" },
}));
