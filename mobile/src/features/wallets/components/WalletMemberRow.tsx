import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ActionPopover, PopoverAction, PopoverAnchor } from "@/components/shared/ActionPopover";
import { Avatar } from "@/components/ui/Avatar";
import { CloseIcon, EditIcon, EyeIcon, TrashIcon } from "@/components/ui/Icon";
import { colorForCategory } from "@/lib/category-color";
import { spacing, typography, createStyles } from "@/lib/theme";
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
 * it, and their role as a pill. For the owner the pill is a dropdown, the
 * way a share sheet does it: switching the role and taking the person out
 * (or the invitation back) are its two entries, each confirmed by the sheet.
 * It used to be a pill that switched on tap plus an × beside it, which put a
 * delete control on every row and needed a hint line to explain the pill.
 *
 * An unanswered invitation is faded and says "Chờ trả lời" in amber, so it
 * never reads as someone already in.
 */
export function WalletMemberRow({ member, isSelf, canManage, separated, onChangeRole, onRemove }: WalletMemberRowProps) {
  const styles = useStyles();
  const pending = member.status === "pending";
  // collapsable={false}: a View with only layout is flattened away on
  // Fabric, and there would be nothing to measure the menu's place from.
  const pillRef = useRef<View>(null);
  const [menuAnchor, setMenuAnchor] = useState<PopoverAnchor | null>(null);
  // Page coordinates: the menu's Modal draws from the top of the screen (see
  // ChatModeHeader's openMenu).
  const openMenu = () =>
    pillRef.current?.measure((_x, _y, width, height, pageX, pageY) =>
      setMenuAnchor({ x: pageX, y: pageY, width, height }),
    );

  const nextRole = member.role === "editor" ? "viewer" : "editor";
  const actions: PopoverAction[] = [
    {
      Icon: nextRole === "viewer" ? EyeIcon : EditIcon,
      label: `Đổi sang ${ROLE_LABEL[nextRole]}`,
      onPress: onChangeRole,
      testID: `menu-wallet-member-role-${member.user_id}`,
    },
    {
      Icon: pending ? CloseIcon : TrashIcon,
      label: pending ? "Thu hồi lời mời" : "Xóa khỏi ví",
      onPress: onRemove,
      destructive: true,
      testID: `menu-wallet-member-remove-${member.user_id}`,
    },
  ];

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
      <View ref={pillRef} collapsable={false}>
        <RolePill
          role={member.role}
          onPress={canManage ? openMenu : undefined}
          accessibilityLabel={`${ROLE_LABEL[member.role]}. Tùy chọn cho ${member.name}`}
          testID={`pill-wallet-member-role-${member.user_id}`}
        />
      </View>
      {canManage ? (
        <ActionPopover
          visible={menuAnchor !== null}
          anchor={menuAnchor}
          align="right"
          actions={actions}
          onClose={() => setMenuAnchor(null)}
        />
      ) : null}
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
}));
