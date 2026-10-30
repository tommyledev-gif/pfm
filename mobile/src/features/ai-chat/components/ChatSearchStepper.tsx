import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Animated from "react-native-reanimated";

import { entrance, exit } from "@/components/motion/motion-tokens";
import { ChevronDownIcon, CloseIcon } from "@/components/ui/Icon";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";

interface ChatSearchStepperProps {
  /** 1-based, newest first. */
  position: number;
  count: number;
  /** The pane's mode colour, for the counter. */
  tint: string;
  onOlder: () => void;
  onNewer: () => void;
  onClose: () => void;
}

/**
 * Floating at the thread's right edge, halfway down, once a search result
 * has been opened and there were others: up to the next older match, down
 * to the next newer one, where it is in the set, and × to put it away. Up
 * and down follow the thread itself: older messages are above.
 */
export function ChatSearchStepper({ position, count, tint, onOlder, onNewer, onClose }: ChatSearchStepperProps) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const canOlder = position < count;
  const canNewer = position > 1;
  return (
    <View pointerEvents="box-none" style={styles.anchor}>
      <Animated.View entering={entrance("fade")} exiting={exit("fade")} style={styles.pill} testID="stepper-chat-search">
        <Pressable
          onPress={onOlder}
          disabled={!canOlder}
          accessibilityRole="button"
          accessibilityLabel={t("chat.search.older.a11y")}
          accessibilityState={{ disabled: !canOlder }}
          style={({ pressed }) => [styles.step, pressed && styles.pressed]}
          testID="btn-chat-search-older"
        >
          <View style={styles.flip}>
            <ChevronDownIcon size={18} color={canOlder ? colors.textPrimary : colors.textMuted} />
          </View>
        </Pressable>
        <Text style={[styles.count, { color: tint }]} accessibilityLabel={t("chat.search.position.a11y", { position, count })}>
          {position}/{count}
        </Text>
        <Pressable
          onPress={onNewer}
          disabled={!canNewer}
          accessibilityRole="button"
          accessibilityLabel={t("chat.search.newer.a11y")}
          accessibilityState={{ disabled: !canNewer }}
          style={({ pressed }) => [styles.step, pressed && styles.pressed]}
          testID="btn-chat-search-newer"
        >
          <ChevronDownIcon size={18} color={canNewer ? colors.textPrimary : colors.textMuted} />
        </Pressable>
        <View style={styles.divider} />
        <Pressable
          onPress={onClose}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={t("chat.search.closeResults.a11y")}
          style={({ pressed }) => [styles.step, pressed && styles.pressed]}
          testID="btn-chat-search-stepper-close"
        >
          <CloseIcon size={12} color={colors.textSecondary} strokeWidth={2.6} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const STEP_SIZE = 40;

const useStyles = createStyles((colors) => ({
  // Fills the pane without taking its touches, to centre the pill on the right.
  anchor: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "flex-end", paddingRight: spacing.md },
  pill: {
    width: STEP_SIZE + 4,
    alignItems: "center",
    paddingVertical: 2,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  step: { width: STEP_SIZE, height: STEP_SIZE, borderRadius: STEP_SIZE / 2, alignItems: "center", justifyContent: "center" },
  pressed: { backgroundColor: withAlpha(colors.overlayBase, 0.08) },
  flip: { transform: [{ rotate: "180deg" }] },
  count: { ...typography.tiny, fontWeight: "700", fontVariant: ["tabular-nums"], paddingVertical: 2 },
  divider: { width: 18, height: StyleSheet.hairlineWidth, backgroundColor: colors.surfaceBorder, marginVertical: 2 },
}));
