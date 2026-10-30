import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";

import { AmountInput } from "@/components/ui/AmountInput";
import { Drawer } from "@/components/shared/Drawer";
import { IconSelectField } from "@/components/shared/IconSelectField";
import { useIconPicker } from "@/components/shared/use-icon-picker";
import { FieldError } from "@/components/ui/FieldError";
import { PillButton } from "@/components/ui/PillButton";
import { errorText } from "@/lib/api-envelope";
import { toCents } from "@/lib/currency";
import { withAlpha } from "@/lib/color";
import { useRequireOnline } from "@/lib/connectivity";
import { TranslationKey } from "@/lib/i18n";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { WALLET_CURRENCIES, WALLET_TYPES, WalletCurrency, WalletType } from "@/lib/constants";
import { useCreateWalletMutation } from "@/features/wallets/api/use-create-wallet-mutation";
import { useUpdateWalletMutation } from "@/features/wallets/api/use-update-wallet-mutation";
import { useUploadWalletIconMutation } from "@/features/wallets/api/use-upload-wallet-icon-mutation";
import { Wallet } from "@/features/wallets/types";
import { WalletColorPicker } from "@/features/wallets/components/WalletColorPicker";
import type { WalletColorKey } from "@/lib/wallet-colors";

const TYPE_LABEL_KEY: Record<WalletType, TranslationKey> = {
  cash: "common.walletType.cash",
  bank: "common.walletType.bank",
  e_wallet: "common.walletType.e_wallet",
  other: "common.walletType.other",
};

interface WalletFormModalProps {
  visible: boolean;
  onClose: () => void;
  editingWallet?: Wallet | null;
}

// Settings → Wallets management: create/edit form. Currency can't be changed
// after creation (backend 409s with CURRENCY_LOCKED), so the currency picker
// is disabled once editing; balance similarly has no update path at all
// (UpdateWalletRequest carries no `balance` field) — only shown on create.
// Icon picker mirrors CategoryFormModal.tsx's pattern exactly
// (specs/wallet-budget-icons/spec.md US-01/US-02).
export function WalletFormModal({ visible, onClose, editingWallet }: WalletFormModalProps) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const requireOnline = useRequireOnline();
  const isEditing = Boolean(editingWallet);
  const createWallet = useCreateWalletMutation();
  const updateWallet = useUpdateWalletMutation();
  const uploadIcon = useUploadWalletIconMutation();
  const [name, setName] = useState("");
  const [type, setType] = useState<WalletType>("cash");
  const [currency, setCurrency] = useState<WalletCurrency>("VND");
  const [initialBalance, setInitialBalance] = useState("");
  const [icon, setIcon] = useState("");
  // undefined = none, null = an existing photo the user chose to drop.
  const [iconUrl, setIconUrl] = useState<string | null | undefined>(undefined);
  // null = automatic (from the wallet's position), SRS Feature-03 US-07.
  const [color, setColor] = useState<WalletColorKey | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (editingWallet) {
      setName(editingWallet.name);
      setType(editingWallet.type);
      setCurrency(editingWallet.currency);
      setIcon(editingWallet.icon ?? "");
      setIconUrl(editingWallet.icon_url ?? undefined);
      setColor(editingWallet.color ?? null);
    } else {
      setName("");
      setType("cash");
      setCurrency("VND");
      setInitialBalance("");
      setIcon("");
      setIconUrl(undefined);
      setColor(null);
    }
    setSubmitAttempted(false);
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

  // One "Biểu tượng" field instead of a photo link plus an emoji input.
  // Picking an emoji also drops any uploaded photo (null = clear it on save),
  // since the photo would otherwise keep winning over the emoji on display.
  const iconPicker = useIconPicker({
    icon,
    onPickEmoji: (emoji) => {
      setIcon(emoji);
      setIconUrl((prev) => (prev ? null : prev));
    },
    onUpload: () => requireOnline(pickIcon),
  });

  const errors = {
    name: !name.trim() ? t("wallets.form.name.required") : undefined,
  };

  const submit = () => {
    setSubmitAttempted(true);
    if (errors.name) return;
    if (isEditing && editingWallet) {
      updateWallet.mutate(
        { id: editingWallet.id, body: { name, type, icon: icon || undefined, icon_url: iconUrl, color } },
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
          icon_url: iconUrl ?? undefined,
          color: color ?? undefined,
        },
        { onSuccess: onClose },
      );
    }
  };

  const activeError = mutation.isError ? mutation.error : uploadIcon.isError ? uploadIcon.error : null;

  return (
    <Drawer visible={visible} onClose={onClose} child={iconPicker.child}>
      <Text style={styles.title}>{isEditing ? t("wallets.form.title.edit") : t("wallets.form.title.create")}</Text>

      <Text style={styles.label}>{t("common.field.icon")}</Text>
      <IconSelectField
        name={name}
        color={colors.mint}
        icon={icon}
        iconUrl={iconUrl ?? undefined}
        uploadStatus={uploadIcon.status}
        onPress={iconPicker.open}
      />

      <Text style={styles.label}>{t("common.field.name")}</Text>
      <TextInput value={name} onChangeText={setName} placeholder={t("wallets.form.name.placeholder")} placeholderTextColor={colors.textMuted} style={styles.input} />
      {submitAttempted ? <FieldError message={errors.name} /> : null}


      <Text style={styles.label}>{t("wallets.form.colour.label")}</Text>
      <WalletColorPicker value={color} onChange={setColor} />

      <Text style={styles.label}>{t("common.field.type")}</Text>
      <View style={styles.chipRow}>
        {WALLET_TYPES.map((walletType) => (
          <Pressable key={walletType} onPress={() => setType(walletType)} style={[styles.chip, type === walletType && styles.chipActive]}>
            <Text style={[styles.chipLabel, type === walletType && styles.chipLabelActive]}>{t(TYPE_LABEL_KEY[walletType])}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>{isEditing ? t("wallets.form.currency.labelLocked") : t("wallets.form.currency.label")}</Text>
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
          <Text style={styles.label}>{t("wallets.form.initialBalance.label", { currency })}</Text>
          <AmountInput value={initialBalance} onChangeText={setInitialBalance} />
        </>
      ) : null}

      {activeError ? (
        <Text style={styles.error}>{errorText(activeError, "wallets.form.error.saveFailed")}</Text>
      ) : null}

      <View style={styles.actions}>
        <PillButton label={t("common.action.cancel")} variant="outline" onPress={onClose} style={styles.flexButton} />
        <PillButton
          label={isEditing ? t("common.action.save") : t("common.action.create")}
          onPress={() => requireOnline(submit)}
          loading={mutation.isPending}
          disabled={submitAttempted && Boolean(errors.name)}
          style={styles.flexButton}
        />
      </View>
    </Drawer>
  );
}

const useStyles = createStyles((colors) => ({
  title: { ...typography.title, color: colors.textPrimary },
  label: { ...typography.caption, color: colors.textSecondary },
  chipRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipDisabled: { opacity: 0.5 },
  chipLabel: { ...typography.caption, color: colors.textSecondary },
  chipLabelActive: { color: colors.onGreen },
  input: {
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
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
}));
