import { useState } from "react";
import { Animated, StyleSheet } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { ListInlineButton, ListRow } from "@/components/ui/grouped-list";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { formatCurrency } from "@/lib/currency";
import { useRequireOnline } from "@/lib/connectivity";
import { radii, createStyles } from "@/lib/theme";
import { Wallet } from "@/features/wallets/types";
import { isOwnWallet } from "@/features/wallets/wallet-access";
import { useSetDefaultWalletMutation } from "@/features/wallets/api/use-set-default-wallet-mutation";
import { usePendingWalletCount } from "@/features/wallets/components/PendingBalanceHint";

const AVATAR_SIZE = 40;

const TYPE_LABEL: Record<Wallet["type"], string> = {
  cash: "Tiền mặt",
  bank: "Ngân hàng",
  e_wallet: "Ví điện tử",
  other: "Khác",
};

interface WalletListItemProps {
  wallet: Wallet;
  /** The wallet's card colour (walletFace), so the row matches its card. */
  faceColor: string;
  onPress: () => void;
  /** 1 → 0 from useHighlightFade — the "you picked this one" border. */
  highlightOpacity?: Animated.Value;
}

/**
 * One wallet in the Wallets screen's grouped list: its icon on its card
 * colour, name, type (or whose shared wallet it is) and balance. Set as
 * default sits on the row of the User's own wallets only — a shared wallet
 * is someone else's to set (specs/shared-wallets BR-01). Lives inside a
 * GroupedListCell, which draws the group around it.
 */
export function WalletListItem({ wallet, faceColor, onPress, highlightOpacity }: WalletListItemProps) {
  const styles = useStyles();
  const requireOnline = useRequireOnline();
  const setDefault = useSetDefaultWalletMutation();
  const pendingCount = usePendingWalletCount(wallet.id);
  // Setting a new default silently swapped it under the user with no way to
  // back out of an accidental tap — a confirm step first, same convention as
  // CategoryListItem's delete prompt, just non-destructive (tone="default").
  const [confirmDefaultOpen, setConfirmDefaultOpen] = useState(false);
  const own = isOwnWallet(wallet);

  const kind = own ? TYPE_LABEL[wallet.type] : `Ví chung của ${wallet.owner_name ?? "người khác"}`;
  const shared = own && (wallet.member_count ?? 0) > 0 ? " · Ví chung" : "";
  const pending = pendingCount > 0 ? ` · ${pendingCount} chưa đồng bộ` : "";

  return (
    <>
      <ListRow
        title={wallet.name}
        subtitle={`${kind}${shared} · ${formatCurrency(wallet.balance, wallet.currency)}${pending}`}
        value={wallet.is_default && own ? "Mặc định" : undefined}
        leading={
          <Avatar name={wallet.name} color={faceColor} size={AVATAR_SIZE} icon={wallet.icon} iconUrl={wallet.icon_url} />
        }
        leadingWidth={AVATAR_SIZE}
        trailing={
          own && !wallet.is_default ? (
            <ListInlineButton
              label="Đặt mặc định"
              tone="default"
              onPress={() => requireOnline(() => setConfirmDefaultOpen(true))}
              disabled={setDefault.isPending}
            />
          ) : undefined
        }
        onPress={onPress}
        testID={`row-wallet-${wallet.id}`}
      />
      {highlightOpacity ? (
        <Animated.View pointerEvents="none" style={[styles.highlightBorder, { opacity: highlightOpacity }]} />
      ) : null}

      <ConfirmDialog
        visible={confirmDefaultOpen}
        tone="default"
        title="Đặt ví mặc định?"
        message={`"${wallet.name}" sẽ trở thành ví mặc định của bạn.`}
        confirmLabel="Đặt mặc định"
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
  // Over the whole cell; the cell clips it to the group's rounded corners.
  highlightBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.listCard,
    borderWidth: 2,
    borderColor: colors.green,
  },
}));
