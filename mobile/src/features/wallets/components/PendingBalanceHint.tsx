import { StyleProp, Text, TextStyle } from "react-native";
import { useTranslation } from "react-i18next";

import { useOutboxStore } from "@/stores/outbox-store";
import { useCurrentUserId } from "@/stores/use-current-user-id";

interface PendingBalanceHintProps {
  count: number;
  style?: StyleProp<TextStyle>;
}

/**
 * How many of the signed-in User's queued Transactions touch this Wallet
 * (source or transfer destination). A count only — queued amounts are never
 * added to a balance (BR-OFF-06, S-OFF-45). Returns a number, so a Wallet
 * card re-renders only when its own count changes.
 */
export function usePendingWalletCount(walletId: string): number {
  const userId = useCurrentUserId();
  return useOutboxStore((s) =>
    userId
      ? (s.byUser[userId] ?? []).filter((i) => i.payload.wallet_id === walletId || i.payload.to_wallet_id === walletId)
          .length
      : 0,
  );
}

export function PendingBalanceHint({ count, style }: PendingBalanceHintProps) {
  const { t } = useTranslation();
  if (count === 0) return null;
  return (
    <Text style={style} numberOfLines={1} testID="text-wallet-pending-sync-hint">
      {t("wallets.card.pendingNotCounted", { count })}
    </Text>
  );
}
