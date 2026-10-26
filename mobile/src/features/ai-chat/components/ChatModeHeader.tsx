import { memo, useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useRouter } from "expo-router";

import { entrance } from "@/components/motion/motion-tokens";
import { ActionPopover, PopoverAction, PopoverAnchor } from "@/components/shared/ActionPopover";
import { useHintTooltip } from "@/components/shared/use-hint-tooltip";
import { ChevronDownIcon, EditIcon, HistoryIcon, MoreVerticalIcon, SearchIcon } from "@/components/ui/Icon";
import { CHAT_MODE_META, ChatMode } from "@/features/ai-chat/chat-mode";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";

interface ChatModeHeaderProps {
  mode: ChatMode;
  onPressMode: () => void;
  /** Opens the message search (ChatSearchBar takes this header's place). */
  onPressSearch: () => void;
  /** The manual transaction form, for when typing a sentence is not the way. */
  onOpenManualEntry: () => void;
}

/**
 * The chat's app bar: the mode as the title, and one overflow button.
 *
 * The title IS the mode switch (a chevron says it opens), the way a chat app
 * puts its model picker in the title: the mode is what the next message
 * means, so it is what the screen is called. Everything else the screen can
 * do sits in the ⋮ menu instead of in a row of buttons. It used to be a logo,
 * a name, a tagline, a search button and a glowing pill, five things for the
 * eye to sort before the thread.
 *
 * Switching mode fades the new title in (keyed by mode), in step with
 * ChatModeBackdrop's wash; the first render just shows it.
 */
export const ChatModeHeader = memo(function ChatModeHeader({
  mode,
  onPressMode,
  onPressSearch,
  onOpenManualEntry,
}: ChatModeHeaderProps) {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const menuHint = useHintTooltip("Tùy chọn khác");
  const [menuAnchor, setMenuAnchor] = useState<PopoverAnchor | null>(null);
  const meta = CHAT_MODE_META[mode];
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);

  // Recording entries only where a transaction can be recorded: asking about
  // spending has nothing to enter or confirm.
  const actions: PopoverAction[] = [
    { Icon: SearchIcon, label: "Tìm tin nhắn", onPress: onPressSearch, testID: "menu-chat-search" },
    ...(mode === "consult"
      ? []
      : [
          { Icon: EditIcon, label: "Nhập thủ công", onPress: onOpenManualEntry, testID: "menu-chat-manual-entry" },
          { Icon: HistoryIcon, label: "Chờ xác nhận", onPress: () => router.push("/pending"), testID: "menu-chat-pending" },
        ]),
  ];

  // The menu is a Modal: the keyboard goes first, or the composer stays
  // lifted under it (see dismiss-keyboard-then.ts).
  // ⚠️ Page coordinates (measure), not measureInWindow: edge to edge, the
  // window ones start under the status bar while the popover's Modal draws
  // from the top of the screen, and the menu opened a status bar too high,
  // over the button that opened it.
  const openMenu = () => {
    Keyboard.dismiss();
    menuHint.ref.current?.measure((_x, _y, width, height, pageX, pageY) =>
      setMenuAnchor({ x: pageX, y: pageY, width, height }),
    );
  };

  return (
    <View style={styles.header}>
      <Pressable
        testID="btn-chat-mode"
        accessibilityRole="button"
        accessibilityLabel={`Chế độ: ${meta.label}. Chạm để đổi.`}
        onPress={onPressMode}
        hitSlop={8}
        style={({ pressed }) => [styles.modeButton, pressed && styles.pressed]}
      >
        <Animated.View key={mode} entering={mounted.current ? entrance("fade") : undefined} style={styles.modeContent}>
          <Text style={styles.title} numberOfLines={1}>
            {meta.label}
          </Text>
          <ChevronDownIcon size={16} color={colors.textSecondary} />
        </Animated.View>
      </Pressable>

      <Pressable
        testID="btn-chat-menu"
        accessibilityRole="button"
        accessibilityLabel="Tùy chọn khác"
        onPress={openMenu}
        {...menuHint}
        hitSlop={6}
        style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
      >
        <MoreVerticalIcon size={20} color={colors.textSecondary} />
      </Pressable>

      <ActionPopover
        visible={menuAnchor !== null}
        anchor={menuAnchor}
        align="right"
        actions={actions}
        onClose={() => setMenuAnchor(null)}
      />
    </View>
  );
});

const useStyles = createStyles((colors) => ({
  // A plain app bar over the mode's wash: no rule under it, the thread's own
  // spacing separates the two.
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    minHeight: 56,
    paddingLeft: spacing.lg,
    paddingRight: spacing.md,
  },
  // Padded so the pressed tint has room around the words; the negative
  // margin keeps the title itself on the screen's text edge.
  modeButton: {
    flexShrink: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginLeft: -spacing.sm + spacing.xs,
    borderRadius: radii.listCard,
  },
  modeContent: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  title: { ...typography.title, color: colors.textPrimary, flexShrink: 1 },
  menuButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  pressed: { backgroundColor: withAlpha(colors.overlayBase, 0.08) },
}));
