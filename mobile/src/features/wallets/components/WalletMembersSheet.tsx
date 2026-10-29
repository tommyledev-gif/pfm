import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Drawer } from "@/components/shared/Drawer";
import { ChevronRightIcon, LogOutIcon, UsersIcon } from "@/components/ui/Icon";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { useRequireOnline } from "@/lib/connectivity";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useCurrentUserId } from "@/stores/use-current-user-id";
import { useWalletMembersQuery } from "@/features/wallets/api/use-wallet-members-query";
import {
  useChangeWalletMemberRoleMutation,
  useRemoveWalletMemberMutation,
} from "@/features/wallets/api/use-wallet-member-mutations";
import { Wallet, WalletMember } from "@/features/wallets/types";
import { isOwnWallet, isSharedWallet } from "@/features/wallets/wallet-access";
import { WalletInviteForm } from "@/features/wallets/components/WalletInviteForm";
import { WalletMemberRow } from "@/features/wallets/components/WalletMemberRow";
import { WalletRecentTransactions } from "@/features/wallets/components/WalletRecentTransactions";
import { WalletSheetHero } from "@/features/wallets/components/WalletSheetHero";
import { NO_OTHER_MEMBERS, memberCountLine } from "@/features/wallets/components/wallet-member-copy";
import {
  PendingMemberAction,
  dialogConfirm,
  dialogMessage,
  dialogTitle,
} from "@/features/wallets/components/wallet-member-dialogs";

interface WalletMembersSheetProps {
  wallet: Wallet;
  /** The wallet's card colour (walletFace), so the sheet's card matches it. */
  faceColor: string;
  visible: boolean;
  onClose: () => void;
}

/**
 * Everything about one shared wallet (specs/shared-wallets US-04 – US-06), in
 * the order a household needs it: which wallet and its shared balance, who is
 * in it, inviting someone (owner only), everyone's entries, and leaving
 * (members only). The owner switches a member between "Ghi chép" and "Chỉ
 * xem" from the role pill and takes someone out with ×; every change is
 * online-only and confirmed first.
 *
 * Entries live here as well as under the carousel: someone else's wallet is
 * no longer in the carousel (it has the Ví chung tab instead), so this sheet
 * is the one place its history shows.
 */
export function WalletMembersSheet({ wallet, faceColor, visible, onClose }: WalletMembersSheetProps) {
  const colors = useColors();
  const styles = useStyles();
  const requireOnline = useRequireOnline();
  const router = useRouter();
  const userId = useCurrentUserId();
  const owner = isOwnWallet(wallet);
  const members = useWalletMembersQuery(visible ? wallet.id : null);
  const changeRole = useChangeWalletMemberRoleMutation(wallet.id);
  const remove = useRemoveWalletMemberMutation(wallet.id);
  const [pending, setPending] = useState<PendingMemberAction | null>(null);
  // Bumped as the sheet's end comes into reach: the entries list pages on.
  const [entriesEnd, setEntriesEnd] = useState(0);

  const list = members.data ?? [];
  const others = list.filter((m) => m.role !== "owner");
  const self = list.find((m) => m.user_id === userId);

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

  const renderMember = (member: WalletMember, index: number) => (
    <WalletMemberRow
      key={member.user_id}
      member={member}
      isSelf={member.user_id === userId}
      canManage={owner && member.role !== "owner"}
      separated={index > 0}
      onChangeRole={() => setPending({ kind: "role", member })}
      onRemove={() => setPending({ kind: "remove", member })}
    />
  );

  return (
    <Drawer visible={visible} onClose={onClose} onEndReached={() => setEntriesEnd((n) => n + 1)}>
      <View testID="sheet-wallet-members" style={styles.body}>
        <WalletSheetHero wallet={wallet} faceColor={faceColor} />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Người trong ví</Text>
            {members.data ? <Text style={styles.sectionMeta}>{memberCountLine(list)}</Text> : null}
          </View>
          <View>
            {members.isLoading ? (
              [0, 1].map((i) => (
                <View key={i} style={styles.skeletonRow}>
                  <SkeletonBlock width={40} height={40} borderRadius={20} />
                  <SkeletonBlock width="50%" height={14} />
                </View>
              ))
            ) : members.isError ? (
              <Pressable onPress={() => void members.refetch()} style={styles.retry} accessibilityRole="button">
                <Text style={styles.retryText}>Chưa tải được danh sách.</Text>
                <Text style={styles.retryAction}>Thử lại</Text>
              </Pressable>
            ) : (
              <>
                {list.map(renderMember)}
                {/* The owner alone: said in so many words, not left to the count. */}
                {others.length === 0 ? (
                  <View style={styles.noOthers} testID="text-wallet-no-other-members">
                    <UsersIcon size={18} color={colors.textMuted} />
                    <Text style={styles.noOthersText}>{NO_OTHER_MEMBERS}</Text>
                  </View>
                ) : null}
              </>
            )}
          </View>
        </View>

        {owner ? <WalletInviteForm walletId={wallet.id} memberCount={others.length} /> : null}

        <View style={styles.section}>
          <WalletRecentTransactions wallet={wallet} loadMoreSignal={entriesEnd} />
          {/* The full list, with search and filters (shared-wallets.tsx). */}
          {isSharedWallet(wallet) ? (
            <Pressable
              onPress={() => {
                onClose();
                router.push({ pathname: "/shared-wallets", params: { walletId: wallet.id } });
              }}
              style={({ pressed }) => [styles.allEntries, pressed && styles.cellPressed]}
              accessibilityRole="link"
              testID="btn-wallet-sheet-all-entries"
            >
              <Text style={styles.allEntriesLabel}>Tìm và lọc mọi giao dịch</Text>
              <ChevronRightIcon size={16} color={colors.green} />
            </Pressable>
          ) : null}
        </View>

        {/* A quiet action at the end, as a settings list puts its one way out. */}
        {!owner && self ? (
          <Pressable
            onPress={() => setPending({ kind: "leave", member: self })}
            style={({ pressed }) => [styles.leave, pressed && styles.cellPressed]}
            accessibilityRole="button"
            testID="btn-wallet-leave"
          >
            <LogOutIcon size={18} color={colors.peach} />
            <Text style={styles.leaveLabel}>Rời ví</Text>
          </Pressable>
        ) : null}
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

// Every section the same way, the way the entries list already was: a quiet
// title (and a count) over rows that sit flush on the sheet, split by
// hairlines. No card around them, so nothing is inset twice.
const useStyles = createStyles((colors) => ({
  body: { gap: spacing.xxl },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  sectionTitle: { ...typography.label, color: colors.textSecondary },
  sectionMeta: { ...typography.caption, color: colors.textMuted },
  skeletonRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  retry: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.lg },
  noOthers: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surfaceBorder,
  },
  noOthersText: { ...typography.body, color: colors.textSecondary },
  retryText: { ...typography.body, color: colors.textSecondary },
  retryAction: { ...typography.body, color: colors.green },
  leave: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  cellPressed: { opacity: 0.6 },
  leaveLabel: { ...typography.body, fontWeight: "600", color: colors.peach },
  allEntries: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
  },
  allEntriesLabel: { ...typography.label, color: colors.green },
}));
