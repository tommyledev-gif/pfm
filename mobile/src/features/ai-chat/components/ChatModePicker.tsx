import { memo, useEffect } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";

import { SPRING } from "@/components/motion/motion-tokens";
import { CheckCircleIcon } from "@/components/ui/Icon";
import { CHAT_MODE_META, CHAT_MODE_ORDER, ChatMode } from "@/features/ai-chat/chat-mode";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useReduceMotion } from "@/lib/use-reduce-motion";

// The sheet grows from just under its size as the Modal fades in
// (animate-ui's Dialog: zoom + fade, short travel).
const OPEN_SCALE = 0.94;
const OPEN_RISE = 8;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
 * Opens like animate-ui's Dialog: the Modal fades and the sheet zooms up to
 * size with it. Reduce Motion: the fade alone.
 *
 * ⚠️ No shadows / elevation on the rows. On Android an elevation shadow is
 * drawn BEHIND the view, and through a translucent tinted background it
 * shows up as a dark rectangle inside the row — which is exactly what the
 * previous "elevated card" version looked like on device.
 */
export const ChatModePicker = memo(function ChatModePicker({ visible, mode, onClose, onSelect }: ChatModePickerProps) {
  const colors = useColors();
  const styles = useStyles();
  const reduceMotion = useReduceMotion();
  // 0 = just opened (small, low), 1 = at rest.
  const open = useSharedValue(1);

  useEffect(() => {
    if (!visible || reduceMotion) return;
    // From 0 every time it opens: a sequence, so the reset is never skipped.
    open.value = withSequence(withTiming(0, { duration: 0 }), withSpring(1, SPRING));
  }, [visible, reduceMotion, open]);

  const sheetMotion = useAnimatedStyle(() => ({
    transform: [
      { translateY: (1 - open.value) * OPEN_RISE },
      { scale: OPEN_SCALE + (1 - OPEN_SCALE) * open.value },
    ],
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Swallows the press so a tap inside the card does not close it. */}
        <AnimatedPressable onPress={() => {}} style={[styles.sheet, sheetMotion]}>
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
        </AnimatedPressable>
      </Pressable>
    </Modal>
  );
});

const useStyles = createStyles((colors) => ({
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
  rowPressed: { backgroundColor: withAlpha(colors.overlayBase, 0.04) },
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
}));
