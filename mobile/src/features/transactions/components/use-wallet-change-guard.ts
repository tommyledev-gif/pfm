import { useState } from "react";
import { useTranslation } from "react-i18next";

import { formatCurrency } from "@/lib/currency";
import { TransactionKind } from "@/lib/constants";
import { Wallet } from "@/features/wallets/types";

interface UseWalletChangeGuardOptions {
  /**
   * Editing a saved income/expense: picking another wallet moves its money
   * (PATCH wallet_id), so it asks first. Off for a create, a queued item and
   * a transfer (whose wallets never change).
   */
  enabled: boolean;
  wallets: Wallet[];
  /** The wallet the saved transaction is on. */
  originalWalletId: string | null;
  /** The chip selected right now: tapping it again changes nothing. */
  selectedWalletId: string | null;
  type: TransactionKind;
  /** Saved amount in cents: what the old wallet gets back. */
  originalAmount: number;
  /** Amount in the form now (null while unfinished): what the new wallet takes. */
  currentAmount: number | null;
  onChange: (walletId: string) => void;
}

/**
 * Changing the wallet of a saved transaction (shared by the AI chat's edit
 * sheet and the manual edit form).
 *
 * Only wallets in the saved one's currency are offered: the amount is in that
 * currency and nothing converts it, and the server refuses any other
 * (WALLET_CURRENCY_MISMATCH). Picking a different one opens a dialog that
 * says which balance goes up and which goes down; nothing is selected until
 * it is confirmed, so "Giữ ví cũ" leaves the selection exactly as it was.
 * Going back to the saved wallet needs no dialog.
 */
export function useWalletChangeGuard({
  enabled,
  wallets,
  originalWalletId,
  selectedWalletId,
  type,
  originalAmount,
  currentAmount,
  onChange,
}: UseWalletChangeGuardOptions) {
  const { t } = useTranslation();
  const [pendingId, setPendingId] = useState<string | null>(null);
  // Kept after closing so the dialog keeps its text while it fades out.
  const [dialogOpen, setDialogOpen] = useState(false);
  const original = wallets.find((w) => w.id === originalWalletId) ?? null;
  const guarding = enabled && original !== null;

  const selectableWallets = enabled && original ? wallets.filter((w) => w.currency === original.currency) : wallets;

  const select = (id: string) => {
    if (id === selectedWalletId) return;
    if (!guarding || id === originalWalletId) {
      onChange(id);
      return;
    }
    setPendingId(id);
    setDialogOpen(true);
  };

  const pending = guarding ? wallets.find((w) => w.id === pendingId) ?? null : null;
  const currency = original?.currency;
  const takenBack = formatCurrency(originalAmount, currency);
  const taken = formatCurrency(currentAmount ?? originalAmount, currency);
  // An expense leaves the old wallet higher and the new one lower; an income
  // the other way round. Applied by the save, not by this tap.
  const message =
    pending && original
      ? t(type === "income" ? "transactions.walletChange.body.income" : "transactions.walletChange.body.expense", {
          from: original.name,
          oldAmount: takenBack,
          to: pending.name,
          newAmount: taken,
        })
      : "";

  return {
    selectableWallets,
    /** Some wallets are hidden because they use another currency. */
    hidesOtherCurrencies: selectableWallets.length < wallets.length,
    select,
    /** Spread onto ConfirmDialog. */
    dialog: {
      visible: dialogOpen && pending !== null,
      title: pending ? t("transactions.walletChange.title", { wallet: pending.name }) : "",
      message,
      confirmLabel: t("transactions.walletChange.confirm"),
      cancelLabel: t("transactions.walletChange.keep"),
      tone: "default" as const,
      testID: "dialog-change-wallet",
      onConfirm: () => {
        if (pending) onChange(pending.id);
        setDialogOpen(false);
      },
      onCancel: () => setDialogOpen(false),
    },
  };
}
