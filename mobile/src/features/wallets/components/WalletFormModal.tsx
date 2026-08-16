import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { PillButton } from "@/components/ui/PillButton";
import { getErrorMessage } from "@/lib/axios";
import { toCents } from "@/lib/currency";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { WALLET_CURRENCIES, WALLET_TYPES, WalletCurrency, WalletType } from "@/lib/constants";
import { useCreateWalletMutation } from "@/features/wallets/api/use-create-wallet-mutation";
import { useUpdateWalletMutation } from "@/features/wallets/api/use-update-wallet-mutation";
import { Wallet } from "@/features/wallets/types";

const TYPE_LABEL: Record<WalletType, string> = {
  cash: "Cash",
  bank: "Bank",
  e_wallet: "E-wallet",
  other: "Other",
};

interface WalletFormModalProps {
  visible: boolean;
  onClose: () => void;
  editingWallet?: Wallet | null;
}

// Profile → Wallets management: create/edit form. Currency can't be changed
// after creation (backend 409s with CURRENCY_LOCKED), so the currency picker
// is disabled once editing; balance similarly has no update path at all
// (UpdateWalletRequest carries no `balance` field) — only shown on create.
export function WalletFormModal({ visible, onClose, editingWallet }: WalletFormModalProps) {
  const isEditing = Boolean(editingWallet);
  const createWallet = useCreateWalletMutation();
  const updateWallet = useUpdateWalletMutation();
  const [name, setName] = useState("");
  const [type, setType] = useState<WalletType>("cash");
  const [currency, setCurrency] = useState<WalletCurrency>("VND");
  const [initialBalance, setInitialBalance] = useState("");

  useEffect(() => {
    if (!visible) return;
    if (editingWallet) {
      setName(editingWallet.name);
      setType(editingWallet.type);
      setCurrency(editingWallet.currency);
    } else {
      setName("");
      setType("cash");
      setCurrency("VND");
      setInitialBalance("");
    }
  }, [visible, editingWallet]);

  const mutation = isEditing ? updateWallet : createWallet;

  const submit = () => {
    if (!name.trim()) return;
    if (isEditing && editingWallet) {
      updateWallet.mutate({ id: editingWallet.id, body: { name, type } }, { onSuccess: onClose });
    } else {
      createWallet.mutate(
        { name, type, currency, initial_balance: initialBalance ? toCents(Number(initialBalance)) : undefined },
        { onSuccess: onClose },
      );
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{isEditing ? "Edit wallet" : "New wallet"}</Text>

          <Text style={styles.label}>Name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="e.g. Cash" placeholderTextColor={colors.textMuted} style={styles.input} />

          <Text style={styles.label}>Type</Text>
          <View style={styles.chipRow}>
            {WALLET_TYPES.map((t) => (
              <Pressable key={t} onPress={() => setType(t)} style={[styles.chip, type === t && styles.chipActive]}>
                <Text style={[styles.chipLabel, type === t && styles.chipLabelActive]}>{TYPE_LABEL[t]}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Currency{isEditing ? " (locked after creation)" : ""}</Text>
          <View style={styles.chipRow}>
            {WALLET_CURRENCIES.map((c) => (
              <Pressable
                key={c}
                onPress={() => !isEditing && setCurrency(c)}
                style={[styles.chip, currency === c && styles.chipActive, isEditing && styles.chipDisabled]}
              >
                <Text style={[styles.chipLabel, currency === c && styles.chipLabelActive]}>{c}</Text>
              </Pressable>
            ))}
          </View>

          {!isEditing ? (
            <>
              <Text style={styles.label}>Initial balance ({currency})</Text>
              <TextInput
                value={initialBalance}
                onChangeText={setInitialBalance}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                style={styles.input}
              />
            </>
          ) : null}

          {mutation.isError ? (
            <Text style={styles.error}>{getErrorMessage(mutation.error, "Could not save wallet")}</Text>
          ) : null}

          <View style={styles.actions}>
            <PillButton label="Cancel" variant="outline" onPress={onClose} style={styles.flexButton} />
            <PillButton
              label={isEditing ? "Save" : "Create"}
              onPress={submit}
              loading={mutation.isPending}
              disabled={!name.trim()}
              style={styles.flexButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.hero,
    borderTopRightRadius: radii.hero,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { ...typography.title, color: colors.textPrimary },
  label: { ...typography.caption, color: colors.textSecondary },
  chipRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipDisabled: { opacity: 0.5 },
  chipLabel: { ...typography.caption, color: colors.textSecondary },
  chipLabelActive: { color: colors.onGreen },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    color: colors.textPrimary,
    ...typography.body,
  },
  error: { color: colors.peach, ...typography.caption },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  flexButton: { flex: 1 },
});
