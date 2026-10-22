import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { CloseIcon } from "@/components/ui/Icon";
import { colorForCategory } from "@/lib/category-color";
import { withAlpha } from "@/lib/color";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { WalletMember } from "@/features/wallets/types";
import { RolePill } from "@/features/wallets/components/RolePill";
import { ROLE_LABEL } from "@/features/wallets/components/wallet-member-copy";

const AVATAR_SIZE = 40;

interface WalletMemberRowProps {
  member: WalletMember;
  isSelf: boolean;
  /** The sheet's viewer owns the wallet and this row is not the owner's. */
  canManage: boolean;
  /** Draws the hairline above this row (every row but the first). */
  separated: boolean;
  onChangeRole: () => void;
  onRemove: () => void;
}

/**
 * One person in a shared wallet: their face and name, @tên đăng nhập under
 * it, and their role as a pill. For the owner, the pill is a button that
 * switches the role and an × takes the person out (or the invitation back);
 * everyone else just reads the row. An unanswered invitation is faded and
 * says "Chờ trả lời" in amber, so it never reads as someone already in.
 */
export function WalletMemberRow({ member, isSelf, canManage, separated, onChangeRole, onRemove }: WalletMemberRowProps) {
  const colors = useColors();
  const styles = useStyles();
  const pending = member.status === "pending";
  const removeLabel = pending ? `Thu hồi lời mời của ${member.name}` : `Xóa ${member.name} khỏi ví`;

  return (
    <View style={[styles.row, separated && styles.separated]} testID={`row-wallet-member-${member.user_id}`}>
      <View style={pending && styles.faded}>
        <Avatar name={member.name} color={colorForCategory(member.user_id)} size={AVATAR_SIZE} fallback="initial" />
      </View>
      <View style={styles.texts}>
        <Text style={styles.name} numberOfLines={1}>
          {member.name}
          {isSelf ? <Text style={styles.self}> (bạn)</Text> : null}
        </Text>
        {pending ? (
          <Text style={styles.pending} numberOfLines={1}>
            Chờ trả lời
          </Text>
        ) : member.username ? (
          <Text style={styles.username} numberOfLines={1}>
            @{member.username}
          </Text>
        ) : null}
      </View>
      <View style={styles.trailing}>
        <RolePill
          role={member.role}
          onPress={canManage ? onChangeRole : undefined}
          accessibilityLabel={`${ROLE_LABEL[member.role]}. Đổi vai trò của ${member.name}`}
          testID={`pill-wallet-member-role-${member.user_id}`}
        />
        {canManage ? (
          <Pressable
            onPress={onRemove}
            hitSlop={10}
            style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
            accessibilityRole="button"
            accessibilityLabel={removeLabel}
            testID={`btn-wallet-member-remove-${member.user_id}`}
          >
            <CloseIcon size={10} color={colors.textSecondary} strokeWidth={2.8} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  separated: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceBorder },
  faded: { opacity: 0.5 },
  texts: { flex: 1, gap: 2 },
  name: { ...typography.body, color: colors.textPrimary },
  self: { color: colors.textSecondary, fontWeight: "500" },
  username: { ...typography.caption, color: colors.textMuted },
  pending: { ...typography.caption, color: colors.mustard },
  trailing: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  remove: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(colors.overlayBase, 0.08),
  },
  removePressed: { backgroundColor: withAlpha(colors.overlayBase, 0.16) },
}));
