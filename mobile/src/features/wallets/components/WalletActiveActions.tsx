import { useState } from "react";
import { Text, View } from "react-native";

import { CheckIcon, EditIcon, UsersIcon } from "@/components/ui/Icon";
import { PressableScale } from "@/components/motion/PressableScale";
import { PillButton } from "@/components/ui/PillButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { withAlpha } from "@/lib/color";
import { useRequireOnline } from "@/lib/connectivity";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { Wallet } from "@/features/wallets/types";
import { isOwnWallet } from "@/features/wallets/wallet-access";
import { useSetDefaultWalletMutation } from "@/features/wallets/api/use-set-default-wallet-mutation";
import { ROLE_LABEL } from "@/features/wallets/components/wallet-member-copy";

interface WalletActiveActionsProps {
  wallet: Wallet;
  onEdit: () => void;
  /** Opens the members sheet (specs/shared-wallets US-05). */
  onOpenMembers: () => void;
}

/**
 * What the Wallets screen's card view offers for the wallet centred in the
 * carousel. The owner gets set-as-default (keeping the list row's confirm
 * step), edit, and sharing; someone the wallet was shared with sees their
 * role and the member list, never edit or default — those are the owner's
 * (specs/shared-wallets BR-01).
 */
export function WalletActiveActions({ wallet, onEdit, onOpenMembers }: WalletActiveActionsProps) {
  const colors = useColors();
  const styles = useStyles();
  const requireOnline = useRequireOnline();
  const setDefault = useSetDefaultWalletMutation();
  const [confirmDefaultOpen, setConfirmDefaultOpen] = useState(false);

  if (!isOwnWallet(wallet)) {
    return (
      <View style={styles.row}>
        <View style={[styles.badge, styles.sharedBadge]} testID="badge-wallet-shared">
          <Text style={styles.sharedLabel} numberOfLines={1}>
            {ROLE_LABEL[wallet.access ?? "viewer"]} · {wallet.owner_name ?? "Ví chung"}
          </Text>
        </View>
        <PillButton
          label="Thành viên"
          icon={<UsersIcon size={16} color={colors.onGreen} />}
          onPress={onOpenMembers}
          style={styles.flex}
          testID="btn-wallet-share"
        />
      </View>
    );
  }

  const memberCount = wallet.member_count ?? 0;

  return (
    <>
      <View style={styles.row}>
        {wallet.is_default ? (
          <View style={[styles.badge, styles.defaultBadge]} testID="badge-wallet-default">
            <CheckIcon size={16} color={colors.green} />
            <Text style={styles.defaultLabel}>Mặc định</Text>
          </View>
        ) : (
          <PillButton
            label="Đặt mặc định"
            variant="outline"
            singleLine
            onPress={() => requireOnline(() => setConfirmDefaultOpen(true))}
            loading={setDefault.isPending}
            style={styles.flex}
            testID="btn-wallet-set-default"
          />
        )}
        <PillButton
          label={memberCount > 0 ? `Chia sẻ · ${memberCount}` : "Chia sẻ"}
          variant="outline"
          singleLine
          icon={<UsersIcon size={16} color={colors.textPrimary} />}
          onPress={onOpenMembers}
          style={styles.flex}
          testID="btn-wallet-share"
        />
        <PressableScale
          onPress={onEdit}
          style={styles.square}
          accessibilityRole="button"
          accessibilityLabel="Sửa ví"
          testID="btn-wallet-edit"
        >
          <EditIcon size={18} color={colors.onGreen} />
        </PressableScale>
      </View>

      <ConfirmDialog
        visible={confirmDefaultOpen}
        tone="default"
        title="Đặt ví mặc định?"
        message={`"${wallet.name}" sẽ trở thành ví mặc định của bạn.`}
        confirmLabel="Lưu"
        onCancel={() => setConfirmDefaultOpen(false)}
        onConfirm={() => {
          setConfirmDefaultOpen(false);
          setDefault.mutate(wallet.id);
        }}
        loading={setDefault.isPending}
      />
    </>
  );
}

const useStyles = createStyles((colors) => ({
  row: { flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1 },
  // The edit action is the one every card has; an icon-sized button leaves
  // the two labelled ones room on a 360 dp phone.
  square: {
    width: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  // Same footprint as the PillButton it stands in for, so the row does not
  // change height when the centred wallet changes.
  badge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  defaultBadge: { borderColor: withAlpha(colors.green, 0.33), backgroundColor: withAlpha(colors.green, 0.07) },
  defaultLabel: { ...typography.body, fontWeight: "700", color: colors.green },
  sharedBadge: { borderColor: colors.surfaceBorder, backgroundColor: withAlpha(colors.overlayBase, 0.05) },
  sharedLabel: { ...typography.label, color: colors.textSecondary },
}));
