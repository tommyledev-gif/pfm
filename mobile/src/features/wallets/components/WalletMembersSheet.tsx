import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { ListCell, ListInlineButton, ListRow, ListSection } from "@/components/ui/grouped-list";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Drawer } from "@/components/shared/Drawer";
import { useRequireOnline } from "@/lib/connectivity";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useCurrentUserId } from "@/stores/use-current-user-id";
import { useWalletMembersQuery } from "@/features/wallets/api/use-wallet-members-query";
import {
  useChangeWalletMemberRoleMutation,
  useRemoveWalletMemberMutation,
} from "@/features/wallets/api/use-wallet-member-mutations";
import { Wallet, WalletMember } from "@/features/wallets/types";
import { isOwnWallet } from "@/features/wallets/wallet-access";
import { WalletInviteForm } from "@/features/wallets/components/WalletInviteForm";
import { ROLE_LABEL, memberStatusLine } from "@/features/wallets/components/wallet-member-copy";

const AVATAR_SIZE = 32;

type PendingAction =
  | { kind: "role"; member: WalletMember }
  | { kind: "remove"; member: WalletMember }
  | { kind: "leave"; member: WalletMember };

interface WalletMembersSheetProps {
  wallet: Wallet;
  visible: boolean;
  onClose: () => void;
}

/**
 * Who shares a wallet (specs/shared-wallets US-05, US-06). The owner invites,
 * switches a member between "Ghi chép" and "Chỉ xem" (tap the row), removes
 * someone or takes an invitation back; a member sees who is in it and can
 * leave. Every change is online-only and confirmed first.
 */
export function WalletMembersSheet({ wallet, visible, onClose }: WalletMembersSheetProps) {
  const colors = useColors();
  const styles = useStyles();
  const requireOnline = useRequireOnline();
  const userId = useCurrentUserId();
  const owner = isOwnWallet(wallet);
  const members = useWalletMembersQuery(visible ? wallet.id : null);
  const changeRole = useChangeWalletMemberRoleMutation(wallet.id);
  const remove = useRemoveWalletMemberMutation(wallet.id);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const others = (members.data ?? []).filter((m) => m.role !== "owner");

  const confirm = () => {
    if (!pending) return;
    const { kind, member } = pending;
    requireOnline(() => {
      if (kind === "role") {
        const role = member.role === "editor" ? "viewer" : "editor";
        changeRole.mutate({ userId: member.user_id, role }, { onSettled: () => setPending(null) });
      } else {
        remove.mutate(member.user_id, {
          onSettled: () => setPending(null),
          // Leaving takes the wallet off this User's list: nothing left to show.
          onSuccess: () => (kind === "leave" ? onClose() : undefined),
        });
      }
    });
  };

  const renderMember = (member: WalletMember) => {
    const isSelf = member.user_id === userId;
    const canManage = owner && member.role !== "owner";
    return (
      <ListRow
        key={member.user_id}
        title={isSelf ? `${member.name} (bạn)` : member.name}
        subtitle={memberStatusLine(member)}
        leading={<Avatar name={member.name} size={AVATAR_SIZE} fallback="initial" />}
        leadingWidth={AVATAR_SIZE}
        onPress={canManage ? () => setPending({ kind: "role", member }) : undefined}
        chevron={false}
        accessibilityHint={canManage ? "Đổi vai trò" : undefined}
        trailing={
          canManage ? (
            <ListInlineButton
              label={member.status === "pending" ? "Thu hồi" : "Xóa"}
              tone="destructive"
              onPress={() => setPending({ kind: "remove", member })}
              testID={`btn-wallet-member-remove-${member.user_id}`}
            />
          ) : isSelf && member.role !== "owner" ? (
            <ListInlineButton
              label="Rời ví"
              tone="destructive"
              onPress={() => setPending({ kind: "leave", member })}
              testID="btn-wallet-leave"
            />
          ) : undefined
        }
        testID={`row-wallet-member-${member.user_id}`}
      />
    );
  };

  return (
    <Drawer visible={visible} onClose={onClose}>
      <View testID="sheet-wallet-members" style={styles.body}>
        <View>
          <Text style={styles.title}>Ví chung</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {wallet.name}
          </Text>
        </View>

        {owner ? <WalletInviteForm walletId={wallet.id} /> : null}

        <ListSection
          header={members.data ? `Trong ví · ${members.data.length} người` : "Trong ví"}
          footer={owner && others.length > 0 ? "Chạm vào một người để đổi vai trò." : undefined}
        >
          {members.isLoading ? (
            <ListCell>
              <ActivityIndicator color={colors.textSecondary} style={styles.loader} />
            </ListCell>
          ) : members.isError ? (
            <ListRow title="Chưa tải được danh sách." variant="accent" onPress={() => void members.refetch()} value="Thử lại" chevron={false} />
          ) : (
            (members.data ?? []).map(renderMember)
          )}
        </ListSection>
      </View>

      <ConfirmDialog
        visible={pending !== null}
        tone={pending?.kind === "role" ? "default" : "destructive"}
        title={dialogTitle(pending, wallet.name)}
        message={dialogMessage(pending)}
        confirmLabel={dialogConfirm(pending)}
        cancelLabel="Giữ lại"
        onCancel={() => setPending(null)}
        onConfirm={confirm}
        loading={changeRole.isPending || remove.isPending}
      />
    </Drawer>
  );
}

function nextRole(member: WalletMember) {
  return member.role === "editor" ? ROLE_LABEL.viewer : ROLE_LABEL.editor;
}

function dialogTitle(action: PendingAction | null, walletName: string): string {
  if (!action) return "";
  if (action.kind === "role") return `Đổi ${action.member.name} sang ${nextRole(action.member)}?`;
  if (action.kind === "leave") return `Rời ví ${walletName}?`;
  return action.member.status === "pending" ? "Thu hồi lời mời?" : `Xóa ${action.member.name} khỏi ví?`;
}

function dialogMessage(action: PendingAction | null): string {
  if (!action) return "";
  if (action.kind === "role") {
    return action.member.role === "editor"
      ? "Người này vẫn xem được ví nhưng không thêm được giao dịch."
      : "Người này thêm được giao dịch vào ví.";
  }
  if (action.kind === "leave") return "Ví sẽ không còn trong danh sách của bạn. Giao dịch bạn đã ghi vẫn ở lại trong ví.";
  return action.member.status === "pending"
    ? `${action.member.name} sẽ không vào được ví này.`
    : `Giao dịch ${action.member.name} đã ghi vẫn ở lại trong ví.`;
}

function dialogConfirm(action: PendingAction | null): string {
  if (!action) return "";
  if (action.kind === "role") return `Đổi sang ${nextRole(action.member)}`;
  if (action.kind === "leave") return "Rời ví";
  return action.member.status === "pending" ? "Thu hồi lời mời" : "Xóa khỏi ví";
}

const useStyles = createStyles((colors) => ({
  body: { gap: spacing.lg },
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  loader: { paddingVertical: spacing.md },
}));
