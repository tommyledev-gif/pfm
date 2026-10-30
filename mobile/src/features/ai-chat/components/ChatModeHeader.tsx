import { memo, useState } from "react";
import { Keyboard, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { ActionPopover, PopoverAction, PopoverAnchor } from "@/components/shared/ActionPopover";
import { useHintTooltip } from "@/components/shared/use-hint-tooltip";
import { EditIcon, HistoryIcon, MoreVerticalIcon, SearchIcon } from "@/components/ui/Icon";
import { ChatMode } from "@/features/ai-chat/chat-mode";
import { ChatModeSwitch } from "@/features/ai-chat/components/ChatModeSwitch";
import { withAlpha } from "@/lib/color";
import { spacing, createStyles, useColors } from "@/lib/theme";

const BUTTON_SIZE = 40;

interface ChatModeHeaderProps {
  mode: ChatMode;
  onSelectMode: (mode: ChatMode) => void;
  /** Opens the message search (ChatSearchBar takes this header's place). */
  onPressSearch: () => void;
  /** The manual transaction form, for when typing a sentence is not the way. */
  onOpenManualEntry: () => void;
}

/**
 * The chat's app bar: the mode switch on the left, search and a ⋮ menu on
 * the right.
 *
 * The mode is what the next message means, so it leads the bar — as a
 * segmented switch with every mode in view (ChatModeSwitch). It used to be
 * the mode's full name as a title with a chevron, opening a sheet of three
 * labels and descriptions: a lot of words to get past for a one-tap choice,
 * and nothing on screen said what the other modes were.
 *
 * Search is the one action every mode has, so it is a button of its own;
 * the recording-only entries (manual entry, the pending list) stay in the
 * menu, which a mode without them does not show.
 */
export const ChatModeHeader = memo(function ChatModeHeader({
  mode,
  onSelectMode,
  onPressSearch,
  onOpenManualEntry,
}: ChatModeHeaderProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const searchHint = useHintTooltip(t("chat.menu.search"));
  const menuHint = useHintTooltip(t("common.action.moreOptions"));
  const [menuAnchor, setMenuAnchor] = useState<PopoverAnchor | null>(null);

  // Recording entries only where a transaction can be recorded: asking about
  // spending has nothing to enter or confirm.
  const actions: PopoverAction[] =
    mode === "consult"
      ? []
      : [
          { Icon: EditIcon, label: t("common.action.manualEntry"), onPress: onOpenManualEntry, testID: "menu-chat-manual-entry" },
          { Icon: HistoryIcon, label: t("common.status.pending"), onPress: () => router.push("/pending"), testID: "menu-chat-pending" },
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
      <ChatModeSwitch mode={mode} onSelect={onSelectMode} />

      <View style={styles.actions}>
        <Pressable
          testID="btn-chat-search"
          accessibilityRole="button"
          accessibilityLabel={t("chat.menu.search")}
          onPress={onPressSearch}
          {...searchHint}
          hitSlop={4}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <SearchIcon size={20} color={colors.textSecondary} />
        </Pressable>
        {actions.length > 0 ? (
          <Pressable
            testID="btn-chat-menu"
            accessibilityRole="button"
            accessibilityLabel={t("common.action.moreOptions")}
            onPress={openMenu}
            {...menuHint}
            hitSlop={4}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <MoreVerticalIcon size={20} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>

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
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { backgroundColor: withAlpha(colors.overlayBase, 0.08) },
}));
