import { ArrowRightGlyph, WalletGlyph } from "@/components/ui/grouped-list/list-icons";
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
  /** A transfer's destination: an arrow instead of the wallet glyph. */
  destination?: boolean;
  error?: string;
  testID?: string;
}

/**
 * The chosen wallet as a row of the form's wallet group — "Ví … Tiền mặt ›" —
 * that opens the wallet list: Apple's selection row + list pattern, since
 * wallets are a list of any length, each worth showing with its balance.
 * Same row as "Vị trí" and "Các món", so the form's choices all look alike.
 */
export function WalletSelectTile({ label, wallet, placeholder, onPress, locked, destination, error, testID }: WalletSelectTileProps) {
  const colors = useColors();
  return (
    <EntryTile
      label={label}
      summary={wallet?.name ?? placeholder}
      muted={!wallet}
      glyph={destination ? ArrowRightGlyph : WalletGlyph}
      tone={destination ? colors.periwinkle : colors.info}
      onPress={onPress}
      locked={locked}
      error={error}
      testID={testID}
      accessibilityLabel={`${label}: ${wallet?.name ?? placeholder}`}
    />
  );
}
