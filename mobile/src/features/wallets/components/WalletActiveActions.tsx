import { useState } from "react";
import { Text, View } from "react-native";

import { CheckIcon, EditIcon } from "@/components/ui/Icon";
import { PillButton } from "@/components/ui/PillButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { Wallet } from "@/features/wallets/types";
import { useSetDefaultWalletMutation } from "@/features/wallets/api/use-set-default-wallet-mutation";

/**
 * What the Wallets screen's card view offers for the wallet centred in the
 * carousel — the same two actions each WalletListItem row carries in the
 * grouped list view (set as default, edit), sized for a single wallet at a
 * time. Set-default keeps the list row's confirm step.
 */
export function WalletActiveActions({ wallet, onEdit }: { wallet: Wallet; onEdit: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  const setDefault = useSetDefaultWalletMutation();
  const [confirmDefaultOpen, setConfirmDefaultOpen] = useState(false);

  return (
    <>
      <View style={styles.row}>
        {wallet.is_default ? (
          <View style={styles.defaultBadge} testID="badge-wallet-default">
            <CheckIcon size={16} color={colors.green} />
            <Text style={styles.defaultLabel}>Ví mặc định</Text>
          </View>
        ) : (
          <PillButton
            label="Đặt mặc định"
            variant="outline"
            onPress={() => setConfirmDefaultOpen(true)}
            loading={setDefault.isPending}
            style={styles.flex}
            testID="btn-wallet-set-default"
          />
        )}
        <PillButton
          label="Sửa ví"
          icon={<EditIcon size={16} color={colors.onGreen} />}
          onPress={onEdit}
          style={styles.flex}
          testID="btn-wallet-edit"
        />
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
  // Same footprint as the PillButton it stands in for, so the row does not
  // change height when the centred wallet changes.
  defaultBadge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: `${colors.green}55`,
    backgroundColor: `${colors.green}12`,
  },
  defaultLabel: { ...typography.body, fontWeight: "700", color: colors.green },
}));
