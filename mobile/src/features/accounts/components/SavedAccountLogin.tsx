import { useRef, useState } from "react";
import { Keyboard, Pressable, ScrollView, Text, View } from "react-native";
import { CaretUpDownIcon } from "phosphor-react-native/src/icons/CaretUpDown";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Avatar } from "@/components/ui/Avatar";
import { PillButton } from "@/components/ui/PillButton";
import { colorForCategory } from "@/lib/category-color";
import { withAlpha } from "@/lib/color";
import { createStyles, spacing, useColors } from "@/lib/theme";
import { useKeyboardHeight } from "@/lib/use-keyboard-height";
import { maskEmail, REMOVE_ACCOUNT_COPY } from "@/features/accounts/account-copy";
import { accountDisplayName, isAccountExpired, useAccountRegistryStore } from "@/features/accounts/account-registry-store";
import { AccountMenuPopover, AnchorRect } from "@/features/accounts/components/AccountMenuPopover";
import { ACCOUNT_STATUS_COPY } from "@/features/accounts/components/AccountRow";
import { switchToAccount } from "@/features/accounts/switch-account";
import { SavedAccount } from "@/features/accounts/types";
import { BrandMark } from "@/features/auth/components/BrandMark";
import { LoginForm } from "@/features/auth/components/LoginForm";

const AVATAR_SIZE = 48;
const ACTION_HEIGHT = 56;
const ACTION_RADIUS = 16;
// Long enough for the keyboard's close animation to finish moving the layout
// before the selector is measured.
const KEYBOARD_SETTLE_MS = 250;

const COPY = {
  signIn: "Đăng nhập",
  pickHint: "Mở danh sách tài khoản",
} as const;

interface SavedAccountLoginProps {
  account: SavedAccount;
  /** Every saved account, most recently used first (`account` among them). */
  accounts: SavedAccount[];
  onSelect: (userId: string) => void;
  onUseAnother: () => void;
  onDone: () => void;
}

/**
 * Login screen, state A: an account is remembered on this device
 * (specs/mobile-account-switch US-05). One centered column: the brand row,
 * the account selector, then one way in:
 *  - session still valid: one tap switches in (identity check first);
 *  - session over ("Hết phiên"): the password, nothing else. An expired
 *    switch token cannot produce a session, so no fingerprint shortcut here.
 *
 * The selector is always the account menu, even with one account (like
 * Gmail's): AccountMenuPopover, pinned under it, holds the other accounts,
 * each row's "Gỡ khỏi thiết bị" ×, and "Dùng tài khoản khác".
 */
export function SavedAccountLogin({ account, accounts, onSelect, onUseAnother, onDone }: SavedAccountLoginProps) {
  const colors = useColors();
  const styles = useStyles();
  const keyboardHeight = useKeyboardHeight();
  const selectorRef = useRef<View>(null);
  const [switching, setSwitching] = useState(false);
  // switchToAccount can find the token refused even though it had not
  // expired by the clock; from then on this account needs its password.
  const [refused, setRefused] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<SavedAccount | null>(null);
  const name = accountDisplayName(account);
  const needsPassword = refused || isAccountExpired(account);

  const continueAs = () => {
    setSwitching(true);
    switchToAccount(account.userId)
      .then((outcome) => {
        if (outcome === "expired") setRefused(true);
      })
      .catch(() => {})
      .finally(() => setSwitching(false));
  };

  // The keyboard moves the selector as it closes, so it is measured only
  // once the keyboard is gone.
  const openMenu = () => {
    const measure = () =>
      selectorRef.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }));
    if (Keyboard.isVisible()) {
      Keyboard.dismiss();
      setTimeout(measure, KEYBOARD_SETTLE_MS);
    } else {
      measure();
    }
  };
  const closeMenu = () => setAnchor(null);

  // Only changes the selection; the password field (keyed by account) then
  // remounts and takes focus.
  const pick = (userId: string) => {
    closeMenu();
    if (userId === account.userId) return;
    setRefused(false);
    onSelect(userId);
  };

  const askRemove = (target: SavedAccount) => {
    closeMenu();
    setPendingRemoval(target);
  };

  const remove = async () => {
    const target = pendingRemoval;
    setPendingRemoval(null);
    if (target) await useAccountRegistryStore.getState().remove(target.userId, { revoke: true, dropLocalData: true });
  };

  const useAnother = () => {
    closeMenu();
    onUseAnother();
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + keyboardHeight }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.column}>
          <BrandMark />

          <Pressable
            ref={selectorRef}
            onPress={openMenu}
            android_ripple={{ color: withAlpha(colors.overlayBase, 0.08) }}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Tài khoản ${name}`}
            accessibilityHint={COPY.pickHint}
            accessibilityState={{ expanded: anchor !== null }}
            testID="btn-login-pick-account"
          >
            <Avatar
              name={name}
              iconUrl={account.avatarUrl}
              color={colorForCategory(account.userId)}
              size={AVATAR_SIZE}
              fallback="initial"
            />
            <View style={styles.cardInfo}>
              <Text style={styles.name} numberOfLines={1}>{name}</Text>
              <Text style={styles.email} numberOfLines={1}>{maskEmail(account.email)}</Text>
            </View>
            {needsPassword ? (
              <View style={styles.pill}>
                <Text style={styles.pillText}>{ACCOUNT_STATUS_COPY.expired}</Text>
              </View>
            ) : null}
            <CaretUpDownIcon size={20} color={colors.textSecondary} />
          </Pressable>

          <View style={styles.action}>
            {needsPassword ? (
              <LoginForm key={account.userId} initialEmail={account.email} hideEmail onDone={onDone} />
            ) : (
              <PillButton
                label={COPY.signIn}
                loading={switching}
                onPress={continueAs}
                style={styles.signIn}
                textStyle={styles.signInLabel}
                testID="btn-login-continue-as"
              />
            )}
          </View>
        </View>
      </ScrollView>

      <AccountMenuPopover
        anchor={anchor}
        accounts={accounts}
        selectedId={account.userId}
        onPick={pick}
        onRemove={askRemove}
        onUseAnother={useAnother}
        onClose={closeMenu}
      />

      <ConfirmDialog
        visible={pendingRemoval !== null}
        title={pendingRemoval ? REMOVE_ACCOUNT_COPY.title(accountDisplayName(pendingRemoval)) : ""}
        message={REMOVE_ACCOUNT_COPY.message}
        confirmLabel={REMOVE_ACCOUNT_COPY.confirm}
        cancelLabel={REMOVE_ACCOUNT_COPY.cancel}
        onConfirm={remove}
        onCancel={() => setPendingRemoval(null)}
        testID="dialog-login-remove-account"
      />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.bgApp },
  content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: spacing.xxl, paddingTop: spacing.md },
  column: { width: "100%", alignItems: "center" },
  card: {
    width: "100%",
    minHeight: 72,
    marginTop: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: ACTION_RADIUS,
    overflow: "hidden",
  },
  cardPressed: { opacity: 0.85 },
  cardInfo: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: "600", color: colors.textPrimary },
  email: { fontSize: 14, color: colors.textSecondary },
  pill: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    backgroundColor: withAlpha(colors.mustard, 0.12),
  },
  pillText: { fontSize: 12, fontWeight: "500", color: colors.mustard },
  action: { width: "100%", marginTop: spacing.xl },
  signIn: { height: ACTION_HEIGHT, borderRadius: ACTION_RADIUS },
  signInLabel: { fontSize: 16 },
}));
