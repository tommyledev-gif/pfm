import { Avatar } from "@/components/ui/Avatar";
import { WalletIcon } from "@/components/ui/Icon";
import { colorForCategory } from "@/lib/category-color";
import { useColors } from "@/lib/theme";
import { Wallet } from "@/features/wallets/types";
import { EntryTile } from "@/features/transactions/components/EntryTile";

interface WalletSelectTileProps {
  label: string;
  wallet: Wallet | null;
  placeholder: string;
  /** Opens the wallet list (useWalletPickerPanel). */
  onPress: () => void;
  /** This transaction's wallet cannot change: a lock replaces the chevron. */
  locked?: boolean;
  /** Half width, for "Từ ví" | "Đến ví" side by side. */
  compact?: boolean;
  error?: string;
  testID?: string;
}

/**
 * The chosen wallet as one row (icon, name, chevron) that opens the wallet
 * list, Apple's "selection row + list" pattern (2026-10-14, was a row of
 * chips): wallets are a list of any length, each worth showing with its
 * balance, which a chip row hides off to the side. Same tile as "Vị trí"
 * and "Các món", so the form's choices all look alike.
 */
export function WalletSelectTile({ label, wallet, placeholder, onPress, locked, compact, error, testID }: WalletSelectTileProps) {
  const colors = useColors();
  return (
    <EntryTile
      label={label}
      summary={wallet?.name ?? placeholder}
      muted={!wallet}
      compact={compact}
      icon={
        wallet ? (
          <Avatar name={wallet.name} color={colorForCategory(wallet.id)} size={24} icon={wallet.icon} iconUrl={wallet.icon_url} />
        ) : (
          <WalletIcon size={16} color={colors.textMuted} />
        )
      }
      onPress={onPress}
      locked={locked}
      error={error}
      testID={testID}
      accessibilityLabel={`${label}: ${wallet?.name ?? placeholder}`}
    />
  );
}
