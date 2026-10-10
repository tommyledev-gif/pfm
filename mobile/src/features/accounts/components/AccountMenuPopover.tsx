import { useState } from "react";
import { Dimensions, Modal, Platform, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckIcon } from "phosphor-react-native/src/icons/Check";
import { PlusIcon } from "phosphor-react-native/src/icons/Plus";
import { XIcon } from "phosphor-react-native/src/icons/X";

import { Avatar } from "@/components/ui/Avatar";
import { colorForCategory } from "@/lib/category-color";
import { withAlpha } from "@/lib/color";
import { createStyles, radii, spacing, typography, useColors } from "@/lib/theme";
import { maskEmail, REMOVE_ACCOUNT_COPY } from "@/features/accounts/account-copy";
import { accountDisplayName, isAccountExpired } from "@/features/accounts/account-registry-store";
import { ACCOUNT_STATUS_COPY } from "@/features/accounts/components/AccountRow";
import { SavedAccount } from "@/features/accounts/types";

/** The selector's frame in window coordinates (measureInWindow). */
export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const GAP = 8;
const EDGE_MARGIN = 16;
const AVATAR_SIZE = 36;

const COPY = {
  close: "Đóng",
  useAnother: "Dùng tài khoản khác",
} as const;

interface AccountMenuPopoverProps {
  /** Where the selector sits; null = closed. */
  anchor: AnchorRect | null;
  /** Every saved account, most recently used first. */
  accounts: SavedAccount[];
  selectedId: string;
  onPick: (userId: string) => void;
  onRemove: (account: SavedAccount) => void;
  onUseAnother: () => void;
  onClose: () => void;
}

/**
 * The login screen's account menu: a popover pinned right under the selector,
 * the same width, laid over the screen (never pushing the button or the
 * password field). Picking a row only changes the selection; each row's ×
 * removes that account from the device (after a confirm). Flips above the
 * selector when there is no room below.
 *
 * A transparent Modal, not an in-tree view: on Android a child drawn outside
 * its parent's bounds does not receive touches. Both translucent flags keep
 * the Modal's window the same edge-to-edge window measureInWindow measured in.
 */
export function AccountMenuPopover({
  anchor,
  accounts,
  selectedId,
  onPick,
  onRemove,
  onUseAnother,
  onClose,
}: AccountMenuPopoverProps) {
  const colors = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [menuHeight, setMenuHeight] = useState(0);
  const ripple = { color: withAlpha(colors.overlayBase, 0.08) };

  // measureInWindow on Android reports y below the status bar, while this
  // Modal's window (statusBarTranslucent) starts at the screen's top edge.
  const windowOffsetY = Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;
  const anchorY = anchor ? anchor.y + windowOffsetY : 0;
  const below = anchor ? anchorY + anchor.height + GAP : 0;
  const windowHeight = Dimensions.get("window").height;
  const fitsBelow = below + menuHeight <= windowHeight - insets.bottom - EDGE_MARGIN;
  const top = anchor && !fitsBelow ? Math.max(anchorY - GAP - menuHeight, insets.top + EDGE_MARGIN) : below;

  return (
    <Modal
      visible={anchor !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={COPY.close} />
      {anchor ? (
        <View
          onLayout={(e) => setMenuHeight(e.nativeEvent.layout.height)}
          // Hidden until measured, so a flip above never shows a frame below first.
          style={[styles.menu, { left: anchor.x, top, width: anchor.width, opacity: menuHeight ? 1 : 0 }]}
          testID="list-login-saved-accounts"
        >
          {accounts.map((account) => {
            const selected = account.userId === selectedId;
            const name = accountDisplayName(account);
            return (
              <View key={account.userId} style={styles.row}>
                <Pressable
                  onPress={() => onPick(account.userId)}
                  android_ripple={ripple}
                  style={({ pressed }) => [styles.pick, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Tài khoản ${name}`}
                  accessibilityState={{ selected }}
                  testID={`row-login-saved-${account.userId}`}
                >
                  <Avatar
                    name={name}
                    iconUrl={account.avatarUrl}
                    color={colorForCategory(account.userId)}
                    size={AVATAR_SIZE}
                    fallback="initial"
                  />
                  <View style={styles.info}>
                    <Text style={styles.name} numberOfLines={1}>{name}</Text>
                    <Text style={styles.email} numberOfLines={1}>{maskEmail(account.email)}</Text>
                  </View>
                  {isAccountExpired(account) ? (
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>{ACCOUNT_STATUS_COPY.expired}</Text>
                    </View>
                  ) : null}
                  <View style={styles.check}>
                    {selected ? <CheckIcon size={18} color={colors.green} weight="bold" /> : null}
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => onRemove(account)}
                  style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={REMOVE_ACCOUNT_COPY.action(name)}
                  testID={`btn-login-remove-${account.userId}`}
                >
                  <XIcon size={16} color={colors.textSecondary} />
                </Pressable>
              </View>
            );
          })}

          <View style={styles.divider} />

          <Pressable
            onPress={onUseAnother}
            android_ripple={ripple}
            style={({ pressed }) => [styles.pick, styles.addRow, pressed && styles.pressed]}
            accessibilityRole="button"
            testID="btn-login-use-another"
          >
            <View style={styles.addCircle}>
              <PlusIcon size={18} color={colors.textPrimary} weight="bold" />
            </View>
            <Text style={[styles.name, styles.info]}>{COPY.useAnother}</Text>
          </Pressable>
        </View>
      ) : null}
    </Modal>
  );
}

const useStyles = createStyles((colors) => ({
  menu: {
    position: "absolute",
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  row: { flexDirection: "row", alignItems: "center", paddingRight: spacing.xs },
  pick: {
    flex: 1,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
  },
  pressed: { opacity: 0.85 },
  info: { flex: 1, gap: 2 },
  name: { ...typography.body, color: colors.textPrimary },
  email: { ...typography.caption, fontWeight: "400", color: colors.textSecondary },
  pill: {
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    backgroundColor: withAlpha(colors.mustard, 0.12),
  },
  pillText: { fontSize: 11, fontWeight: "500", color: colors.mustard },
  check: { width: 18, alignItems: "center" },
  // 48px target, kept apart from the pick area by the row's own gap.
  remove: { width: 48, height: 48, marginLeft: spacing.xs, alignItems: "center", justifyContent: "center" },
  divider: { height: 1, marginVertical: spacing.xs, backgroundColor: colors.surfaceBorder },
  addRow: { paddingRight: spacing.md },
  addCircle: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.surfaceBorder,
  },
}));
