import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Avatar } from "@/components/ui/Avatar";
import { TrashIcon } from "@/components/ui/Icon";
import { colorForCategory } from "@/lib/category-color";
import { withAlpha } from "@/lib/color";
import { TranslationKey } from "@/lib/i18n";
import { createStyles, radii, spacing, typography, useColors } from "@/lib/theme";
import { maskEmail, REMOVE_ACCOUNT_COPY } from "@/features/accounts/account-copy";
import { accountDisplayName, isAccountExpired } from "@/features/accounts/account-registry-store";
import { SavedAccount } from "@/features/accounts/types";

interface AccountRowProps {
  account: SavedAccount;
  isActive: boolean;
  onPress: (account: SavedAccount) => void;
  /** "Gỡ khỏi thiết bị" — offered on every row, the active one too. */
  onRemove?: (account: SavedAccount) => void;
  /** Half-hide the email — on the login screen, which anyone holding the phone can see. */
  maskEmail?: boolean;
  testID: string;
}

const AVATAR_SIZE = 40;
export const ACCOUNT_STATUS_COPY = {
  active: "accounts.row.active",
  expired: "accounts.row.expired",
} as const satisfies Record<string, TranslationKey>;

/** One saved account in the switch dialog / login chooser (spec US-02 step 4). */
export function AccountRow({ account, isActive, onPress, onRemove, maskEmail: masked = false, testID }: AccountRowProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const expired = !isActive && isAccountExpired(account);
  const status = isActive ? ACCOUNT_STATUS_COPY.active : expired ? ACCOUNT_STATUS_COPY.expired : null;

  return (
    <View style={styles.row}>
      <Pressable
        style={styles.main}
        onPress={() => onPress(account)}
        disabled={isActive}
        accessibilityRole="button"
        accessibilityState={{ disabled: isActive, selected: isActive }}
        testID={testID}
      >
        <Avatar
          name={accountDisplayName(account)}
          iconUrl={account.avatarUrl}
          color={colorForCategory(account.userId)}
          size={AVATAR_SIZE}
          fallback="initial"
        />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{accountDisplayName(account)}</Text>
          <Text style={styles.email} numberOfLines={1}>{masked ? maskEmail(account.email) : account.email}</Text>
          {status ? <Text style={[styles.status, isActive && styles.statusActive]}>{t(status)}</Text> : null}
        </View>
      </Pressable>
      {onRemove ? (
        <Pressable
          onPress={() => onRemove(account)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t(REMOVE_ACCOUNT_COPY.action, { name: accountDisplayName(account) })}
          testID={`btn-account-remove-${account.userId}`}
          style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
        >
          <TrashIcon size={18} color={colors.peach} />
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md },
  info: { flex: 1, gap: 2 },
  name: { ...typography.body, color: colors.textPrimary },
  email: { ...typography.caption, color: colors.textSecondary },
  status: { ...typography.tiny, color: colors.mustard },
  statusActive: { color: colors.green },
  remove: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(colors.peach, 0.12),
  },
  removePressed: { opacity: 0.7 },
}));
