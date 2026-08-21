import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";

import { Avatar } from "@/components/ui/Avatar";
import { Drawer } from "@/components/shared/Drawer";
import { PillButton } from "@/components/ui/PillButton";
import { getErrorMessage } from "@/lib/axios";
import { toCents } from "@/lib/currency";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { WALLET_CURRENCIES, WALLET_TYPES, WalletCurrency, WalletType } from "@/lib/constants";
import { useCreateWalletMutation } from "@/features/wallets/api/use-create-wallet-mutation";
import { useUpdateWalletMutation } from "@/features/wallets/api/use-update-wallet-mutation";
import { useUploadWalletIconMutation } from "@/features/wallets/api/use-upload-wallet-icon-mutation";
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
// Icon picker mirrors CategoryFormModal.tsx's pattern exactly
// (specs/wallet-budget-icons/spec.md US-01/US-02).
export function WalletFormModal({ visible, onClose, editingWallet }: WalletFormModalProps) {
  const isEditing = Boolean(editingWallet);
  const createWallet = useCreateWalletMutation();
  const updateWallet = useUpdateWalletMutation();
  const uploadIcon = useUploadWalletIconMutation();
  const [name, setName] = useState("");
  const [type, setType] = useState<WalletType>("cash");
  const [currency, setCurrency] = useState<WalletCurrency>("VND");
  const [initialBalance, setInitialBalance] = useState("");
  const [icon, setIcon] = useState("");
  const [iconUrl, setIconUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!visible) return;
    if (editingWallet) {
      setName(editingWallet.name);
      setType(editingWallet.type);
      setCurrency(editingWallet.currency);
      setIcon(editingWallet.icon ?? "");
      setIconUrl(editingWallet.icon_url ?? undefined);
    } else {
      setName("");
      setType("cash");
      setCurrency("VND");
      setInitialBalance("");
      setIcon("");
      setIconUrl(undefined);
    }
  }, [visible, editingWallet]);

  const mutation = isEditing ? updateWallet : createWallet;

  // Uploads immediately on pick (POST /wallets/icon returns the R2 URL right
  // away) rather than deferring to submit — same convention as
  // CategoryFormModal.tsx.
  const pickIcon = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? "image/jpeg";
    const name = asset.fileName ?? `icon.${mimeType.split("/")[1] ?? "jpg"}`;
    uploadIcon.mutate(
      { uri: asset.uri, name, mimeType },
      { onSuccess: (data) => setIconUrl(data.icon_url) },
    );
  };

  const submit = () => {
    if (!name.trim()) return;
    if (isEditing && editingWallet) {
      updateWallet.mutate(
        { id: editingWallet.id, body: { name, type, icon: icon || undefined, icon_url: iconUrl } },
        { onSuccess: onClose },
      );
    } else {
      createWallet.mutate(
        {
          name,
          type,
          currency,
          initial_balance: initialBalance ? toCents(Number(initialBalance)) : undefined,
          icon: icon || undefined,
          icon_url: iconUrl,
        },
        { onSuccess: onClose },
      );
    }
  };

  const activeError = mutation.isError ? mutation.error : uploadIcon.isError ? uploadIcon.error : null;

  return (
    <Drawer visible={visible} onClose={onClose}>
      <Text style={styles.title}>{isEditing ? "Edit wallet" : "New wallet"}</Text>

      <View style={styles.iconPickerRow}>
        <View style={styles.iconPreview}>
          {uploadIcon.isPending ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <Avatar name={name || "?"} color={colors.mint} size={56} icon={icon} iconUrl={iconUrl} />
          )}
        </View>
        <Pressable onPress={pickIcon} disabled={uploadIcon.isPending} hitSlop={8}>
          <Text style={styles.changePhoto}>{iconUrl ? "Change photo" : "Upload photo"}</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Name</Text>
      <TextInput value={name} onChangeText={setName} placeholder="e.g. Cash" placeholderTextColor={colors.textMuted} style={styles.input} />

      <Text style={styles.label}>Emoji icon (used when no photo is set)</Text>
      <TextInput
        value={icon}
        onChangeText={setIcon}
        placeholder="e.g. 💵"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />

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

      {activeError ? (
        <Text style={styles.error}>{getErrorMessage(activeError, "Could not save wallet")}</Text>
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
    </Drawer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.textPrimary },
  iconPickerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconPreview: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
  changePhoto: { ...typography.label, color: colors.green },
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
