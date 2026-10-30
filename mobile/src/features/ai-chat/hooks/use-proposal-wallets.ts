import { PROPOSAL_CURRENCY, TransactionKind } from "@/lib/constants";
import { useTranslation } from "react-i18next";
import { useWalletChangeGuard } from "@/features/transactions/components/use-wallet-change-guard";
import { useWalletPickerPanel } from "@/features/transactions/components/use-wallet-picker-panel";
import { Wallet } from "@/features/wallets/types";

interface UseProposalWalletsOptions {
  wallets: Wallet[] | undefined;
  /** The Transaction behind a saved proposal; null for an unsaved one. */
  savedId: string | null;
  /** Unsaved proposal: its amount was read as VND (spec AC-33). */
  vndOnly?: boolean;
  type: TransactionKind;
  /** The Wallet the proposal was on when the sheet opened. */
  originalWalletId: string | null;
  walletId: string | null;
  onChangeWallet: (id: string) => void;
  toWalletId: string | null;
  onChangeToWallet: (id: string) => void;
  originalAmount: number;
  currentAmount: number | null;
}

/**
 * The source and destination Wallets of EditTransactionModal, with the
 * panels that list them. Split out for that file's 300-line limit.
 *
 * An unsaved proposal offers VND Wallets only. A saved income/expense can
 * move to another Wallet in its currency, after a dialog (useWalletChangeGuard).
 * A saved transfer keeps both: the server refuses to move one
 * (TRANSFER_WALLET_IMMUTABLE).
 */
export function useProposalWallets({
  wallets = [],
  savedId,
  vndOnly,
  type,
  originalWalletId,
  walletId,
  onChangeWallet,
  toWalletId,
  onChangeToWallet,
  originalAmount,
  currentAmount,
}: UseProposalWalletsOptions) {
  const { t } = useTranslation();
  const isTransfer = type === "transfer";
  const walletChange = useWalletChangeGuard({
    enabled: savedId !== null && !isTransfer,
    wallets,
    originalWalletId,
    selectedWalletId: walletId,
    type,
    originalAmount,
    currentAmount,
    onChange: onChangeWallet,
  });
  const selectable = vndOnly ? wallets.filter((w) => w.currency === PROPOSAL_CURRENCY) : walletChange.selectableWallets;
  // A proposal kept on a non-VND Wallet (or none) starts with nothing chosen.
  const wallet = selectable.find((w) => w.id === walletId) ?? null;
  // Never the source itself, and only in its currency: the server refuses
  // anything else (TRANSFER_SAME_WALLET, TRANSFER_CURRENCY_MISMATCH). A
  // destination that stops qualifying (the source moved onto it) reads as
  // none chosen.
  const destinations = selectable.filter((w) => w.id !== wallet?.id && (!wallet || w.currency === wallet.currency));
  const destination = destinations.find((w) => w.id === toWalletId) ?? null;

  const sourcePicker = useWalletPickerPanel({
    title: t(isTransfer ? "common.field.fromWallet" : "common.field.wallet"),
    wallets: selectable,
    selectedId: wallet?.id ?? null,
    onSelect: walletChange.select,
  });
  const destinationPicker = useWalletPickerPanel({
    title: t("common.field.toWallet"),
    wallets: destinations,
    selectedId: destination?.id ?? null,
    onSelect: onChangeToWallet,
  });

  return {
    /** Every Wallet this proposal may be on. */
    selectable,
    wallet,
    destinations,
    destination,
    sourcePicker,
    destinationPicker,
    /** Some Wallets are hidden because they use another currency. */
    hidesOtherCurrencies: walletChange.hidesOtherCurrencies,
    /** Spread onto ConfirmDialog. */
    changeDialog: walletChange.dialog,
  };
}
