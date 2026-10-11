import { useEffect, useState } from "react";
import { Keyboard, Pressable, Text, View } from "react-native";

import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { SingleDatePickerModal } from "@/components/shared/SingleDatePickerModal";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles } from "@/lib/theme";
import { PROPOSAL_CURRENCY, TRANSACTION_TYPES, TransactionType } from "@/lib/constants";
import { useAmountExpression } from "@/lib/use-amount-expression";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useCategoryPicker } from "@/features/categories/components/use-category-picker";
import { TransactionKeypadFooter } from "@/features/transactions/components/TransactionKeypadFooter";
import { WalletChipRow } from "@/features/transactions/components/WalletChipRow";
import { useOpenWalletCreator } from "@/features/wallets/use-open-wallet-creator";
import { NO_VND_WALLET_HINT } from "@/features/ai-chat/proposal-wallet";
import { TransactionActionPayload } from "@/features/ai-chat/types";

const FALLBACK_CURRENCY = "VND";

interface EditTransactionModalProps {
  visible: boolean;
  payload: TransactionActionPayload | null;
  onClose: () => void;
  onSave: (payload: TransactionActionPayload) => void;
  // True when target is already confirmed (a real Transaction exists) —
  // ai-chat.tsx's editAction then PATCHes that Transaction in place, and
  // backend/internal/dto/transaction_request.go's UpdateTransactionRequest
  // structurally excludes wallet_id/type (an update can't move money between
  // wallets or flip income↔expense). Locking these two pickers here keeps
  // the form honest about what an edit can actually change, instead of
  // silently dropping a wallet/type change the user thinks they made.
  lockWalletAndType?: boolean;
  // An unconfirmed AI proposal: its amount was read as VND, so only VND
  // Wallets are offered and Save stays disabled until one is chosen (spec
  // AC-33). Off for confirmed proposals, whose Wallet is locked anyway.
  vndOnly?: boolean;
}

// Lets the user correct a proposal the AI got wrong (wrong category, wrong
// date, wrong amount, …) — opened via a 500ms long-press on an assistant
// chat bubble that carries a transaction action (see ai-chat.tsx). Editing
// an unconfirmed proposal mutates it in place before it's ever saved;
// editing an already-confirmed one PATCHes the real Transaction record in
// place — either way this same modal is reused, only the caller's `onSave`
// handler and this component's `lockWalletAndType` prop differ.
//
// Same keypad layout as TransactionFormModal (reference-ui/): type and wallet
// scroll in the body; the amount keypad, category chip, note and the date
// key (which replaced the inline calendar that used to make this the
// longest sheet in the app) are pinned in the Drawer footer.
export function EditTransactionModal({
  visible,
  payload,
  onClose,
  onSave,
  lockWalletAndType,
  vndOnly,
}: EditTransactionModalProps) {
  const styles = useStyles();
  const [type, setType] = useState<TransactionType>("expense");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const wallets = useWalletsQuery();
  const openWalletCreator = useOpenWalletCreator();
  const selectableWallets = (wallets.data ?? []).filter((w) => !vndOnly || w.currency === PROPOSAL_CURRENCY);
  // A proposal kept on a non-VND Wallet (or none) starts with nothing chosen.
  const chosenWalletId = selectableWallets.some((w) => w.id === walletId) ? walletId : null;
  // Declared after the wallet: the keypad's decimals follow its currency.
  const currency = wallets.data?.find((w) => w.id === chosenWalletId)?.currency ?? FALLBACK_CURRENCY;
  const amount = useAmountExpression(currency);
  const { reset: resetAmount } = amount;
  const [occurredAt, setOccurredAt] = useState("");
  const [note, setNote] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const categories = useCategoriesQuery(type);

  useEffect(() => {
    if (!visible || !payload) return;
    setType(payload.type);
    resetAmount(payload.amount);
    setCategoryId(payload.category_id);
    setWalletId(payload.wallet_id);
    // react-native-calendars requires a strict "YYYY-MM-DD" key, but
    // payload.occurred_at may be a full timestamp (see format-date.ts) —
    // the first 10 characters are "YYYY-MM-DD" either way.
    setOccurredAt(payload.occurred_at.slice(0, 10));
    setNote(payload.note ?? "");
    setSubmitAttempted(false);
  }, [visible, payload, resetAmount]);

  // Switching type can leave a category selected that belongs to the other
  // type's list (expense categories aren't valid once type flips to income).
  useEffect(() => {
    if (!categories.data) return;
    if (categoryId && categories.data.some((c) => c.id === categoryId)) return;
    setCategoryId(categories.data[0]?.id ?? null);
  }, [type, categoryId, categories.data]);

  const categoryPicker = useCategoryPicker({
    categories: categories.data ?? [],
    selectedIds: categoryId ? [categoryId] : [],
    onApply: (ids) => setCategoryId(ids[0] ?? null),
  });

  const itemCount = payload?.items?.length ?? 0;
  const itemsTotal = payload?.items?.reduce((sum, item) => sum + item.amount, 0) ?? 0;
  const amountValid = amount.cents !== null && amount.cents > 0;
  const canSave = amountValid && Boolean(categoryId) && Boolean(chosenWalletId) && Boolean(occurredAt);
  const errors = submitAttempted
    ? [
        categoryId ? undefined : "Vui lòng chọn danh mục",
        amount.problem ?? (amountValid ? undefined : "Vui lòng nhập số tiền"),
      ]
    : [];

  const submit = () => {
    Keyboard.dismiss();
    setSubmitAttempted(true);
    // Trims/evaluates an expression still being typed ("120+"), so what is
    // saved is exactly what the amount display then shows.
    const cents = amount.resolve();
    if (cents === null || cents <= 0 || !categoryId || !chosenWalletId || !occurredAt) return;
    // The Items stay only while the amount is still their sum — a changed
    // amount would fail the balance rule on save (specs/transaction-line-items BR-07).
    const keepItems = Boolean(payload?.items?.length) && cents === itemsTotal;
    onSave({
      wallet_id: chosenWalletId,
      category_id: categoryId,
      amount: cents,
      type,
      note: note.trim() || null,
      occurred_at: occurredAt,
      ...(keepItems ? { items: payload?.items } : {}),
    });
  };

  return (
    <>
      <Drawer
        visible={visible}
        onClose={onClose}
        child={categoryPicker.child}
        footer={
          <TransactionKeypadFooter
            amount={amount}
            currency={currency}
            type={type}
            category={categoryPicker.selected[0] ?? null}
            onPressCategory={categoryPicker.open}
            note={note}
            onChangeNote={setNote}
            occurredAt={occurredAt}
            onPressDate={() => setDatePickerOpen(true)}
            errors={errors}
            onSubmit={submit}
          />
        }
      >
        <DrawerHeader
          title="Sửa giao dịch"
          actions={[
            { label: "Hủy", onPress: onClose, variant: "secondary" },
            { label: "Lưu", onPress: submit, disabled: !canSave },
          ]}
        />

        {itemCount > 0 ? (
          <Text style={styles.lockedHint}>
            {amount.cents === itemsTotal ? `${itemCount} món. Đổi số tiền sẽ bỏ danh sách món.` : "Số tiền đã đổi. Danh sách món sẽ bị bỏ khi lưu."}
          </Text>
        ) : null}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Loại</Text>
          <View style={styles.chipRow}>
            {TRANSACTION_TYPES.map((t) => (
              <Pressable
                key={t}
                onPress={() => !lockWalletAndType && setType(t)}
                disabled={lockWalletAndType}
                style={[styles.chip, type === t && styles.chipActive, lockWalletAndType && styles.chipDisabled]}
              >
                <Text style={[styles.chipLabel, type === t && styles.chipLabelActive]}>
                  {t === "expense" ? "Chi" : "Thu"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Ví</Text>
          <WalletChipRow
            wallets={selectableWallets}
            selectedId={chosenWalletId}
            onSelect={setWalletId}
            locked={lockWalletAndType}
          />
          {vndOnly && wallets.data && selectableWallets.length === 0 ? (
            <>
              <Text testID="txt-edit-no-vnd-wallet" style={styles.lockedHint}>
                {NO_VND_WALLET_HINT}
              </Text>
              {/* Closed first: the sheet would otherwise sit over the
                  Wallets screen it just opened. */}
              <Pressable
                onPress={() => {
                  onClose();
                  openWalletCreator();
                }}
                hitSlop={8}
                testID="btn-edit-create-vnd-wallet"
              >
                <Text style={styles.createWalletLink}>Tạo ví VND →</Text>
              </Pressable>
            </>
          ) : null}
          {lockWalletAndType ? (
            <Text style={styles.lockedHint}>Không thể đổi loại và ví của giao dịch đã lưu</Text>
          ) : null}
        </View>
      </Drawer>

      <SingleDatePickerModal
        visible={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        value={occurredAt}
        onApply={setOccurredAt}
      />
    </>
  );
}

const useStyles = createStyles((colors) => ({
  fieldGroup: { gap: spacing.xs },
  label: { ...typography.caption, color: colors.textSecondary },
  chipRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  chip: {
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipDisabled: { opacity: 0.4 },
  chipLabel: { ...typography.caption, color: colors.textSecondary },
  chipLabelActive: { color: colors.onGreen },
  lockedHint: { ...typography.tiny, color: colors.textMuted },
  createWalletLink: { ...typography.caption, color: colors.green },
}));
