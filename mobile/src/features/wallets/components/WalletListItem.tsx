import { useState } from "react";
import { Animated, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

import { Avatar } from "@/components/ui/Avatar";
import { ListInlineButton, ListRow } from "@/components/ui/grouped-list";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { formatCurrency } from "@/lib/currency";
import { useRequireOnline } from "@/lib/connectivity";
import { TranslationKey } from "@/lib/i18n";
import { radii, createStyles } from "@/lib/theme";
import { Wallet } from "@/features/wallets/types";
import { isOwnWallet } from "@/features/wallets/wallet-access";
import { useSetDefaultWalletMutation } from "@/features/wallets/api/use-set-default-wallet-mutation";
import { usePendingWalletCount } from "@/features/wallets/components/PendingBalanceHint";

const AVATAR_SIZE = 40;

const TYPE_LABEL_KEY: Record<Wallet["type"], TranslationKey> = {
  cash: "common.walletType.cash",
  bank: "common.walletType.bank",
  e_wallet: "common.walletType.e_wallet",
  other: "common.walletType.other",
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
  const { t } = useTranslation();
  const requireOnline = useRequireOnline();
  const setDefault = useSetDefaultWalletMutation();
  const pendingCount = usePendingWalletCount(wallet.id);
  // Setting a new default silently swapped it under the user with no way to
  // back out of an accidental tap — a confirm step first, same convention as
  // CategoryListItem's delete prompt, just non-destructive (tone="default").
  const [confirmDefaultOpen, setConfirmDefaultOpen] = useState(false);
  const own = isOwnWallet(wallet);

  const kind = own
    ? t(TYPE_LABEL_KEY[wallet.type])
    : t("wallets.owner.sharedBy", { owner: wallet.owner_name ?? t("wallets.owner.unknown") });
  const shared = own && (wallet.member_count ?? 0) > 0 ? t("common.label.sharedWallet") : null;
  const pending = pendingCount > 0 ? t("wallets.list.pendingSync", { count: pendingCount }) : null;
  // Each part is its own phrase; only the separator joins them.
  const subtitle = [kind, shared, formatCurrency(wallet.balance, wallet.currency), pending]
    .filter((part) => part !== null)
    .join(" · ");

  return (
    <>
      <ListRow
        title={wallet.name}
        subtitle={subtitle}
        value={wallet.is_default && own ? t("common.label.default") : undefined}
        leading={
          <Avatar name={wallet.name} color={faceColor} size={AVATAR_SIZE} icon={wallet.icon} iconUrl={wallet.icon_url} />
        }
        leadingWidth={AVATAR_SIZE}
        trailing={
          own && !wallet.is_default ? (
            <ListInlineButton
              label={t("common.action.setDefault")}
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
        title={t("wallets.setDefault.confirm.title")}
        message={t("wallets.setDefault.confirm.body", { wallet: wallet.name })}
        confirmLabel={t("common.action.setDefault")}
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
