import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { onlineManager } from "@tanstack/react-query";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PillButton } from "@/components/ui/PillButton";
import { PlusIcon, ShieldIcon, TrashIcon } from "@/components/ui/Icon";
import { getErrorMessage } from "@/lib/api-envelope";
import { formatDateDMY } from "@/lib/format-date";
import { createStyles, radii, spacing, typography, useColors } from "@/lib/theme";
import { useToastStore } from "@/stores/toast-store";
import { useDeletePasskeyMutation, usePasskeysQuery, useRegisterPasskeyMutation } from "@/features/security/api/use-passkeys-query";
import { PasskeyNativeError, passkeysAvailable } from "@/features/security/passkeys/native-passkey";
import { PasskeyItem } from "@/features/security/passkeys/types";
import { passkeyFailureMessage } from "@/features/security/passkeys/passkey-messages";
import { PasskeyProviderHelp } from "@/features/security/components/PasskeyProviderHelp";

const COPY = {
  title: "Passkey",
  hint: "Đăng nhập và chuyển sang tài khoản này bằng vân tay hoặc khuôn mặt, không cần mật khẩu.",
  add: "Thêm passkey",
  unsupported: "Bản ứng dụng này chưa dùng được passkey.",
  empty: "Chưa có passkey.",
  loadFailed: "Chưa tải được danh sách passkey.",
  added: "Đã thêm passkey",
  addFailed: "Chưa thêm được passkey. Thử lại.",
  offline: "Cần kết nối mạng để thêm passkey.",
  deleted: "Đã xóa passkey",
  deleteFailed: "Chưa xóa được passkey. Thử lại.",
  confirmTitle: "Xóa passkey này?",
  confirmLabel: "Xóa passkey",
} as const;

const confirmMessage = (name: string) => `${name} sẽ không đăng nhập bằng passkey này được nữa.`;

function usedLine(p: PasskeyItem): string {
  const added = `Thêm ${formatDateDMY(p.created_at)}`;
  return p.last_used_at ? `${added} · Dùng ${formatDateDMY(p.last_used_at)}` : added;
}

/**
 * The account's passkeys on the Security screen: what is registered (any
 * phone), adding one on this phone, removing one. Removing works anywhere;
 * adding needs a build with the passkey module (passkeysAvailable).
 */
export function PasskeysSection() {
  const colors = useColors();
  const styles = useStyles();
  const available = passkeysAvailable();
  const passkeys = usePasskeysQuery();
  const register = useRegisterPasskeyMutation();
  const remove = useDeletePasskeyMutation();
  const [confirming, setConfirming] = useState<PasskeyItem | null>(null);
  const [needsProvider, setNeedsProvider] = useState(false);
  // The guide was already up and the retry hit the same wall.
  const [providerStillMissing, setProviderStillMissing] = useState(false);
  const toast = useToastStore.getState().show;

  const closeProviderHelp = () => {
    setNeedsProvider(false);
    setProviderStillMissing(false);
  };

  const add = () => {
    if (!onlineManager.isOnline()) {
      toast(COPY.offline, "warning");
      return;
    }
    register.mutate(undefined, {
      onSuccess: () => {
        closeProviderHelp();
        toast(COPY.added, "info");
      },
      onError: (error) => {
        // Nothing on the phone can keep a passkey: a toast cannot fix that,
        // the guide with its settings button can.
        if (error instanceof PasskeyNativeError && error.kind === "no-provider") {
          setProviderStillMissing(needsProvider);
          setNeedsProvider(true);
          return;
        }
        if (error instanceof PasskeyNativeError) {
          const message = passkeyFailureMessage(error.kind, "add");
          if (message) toast(message, "warning");
          return;
        }
        toast(getErrorMessage(error, COPY.addFailed), "warning");
      },
    });
  };

  const confirmDelete = () => {
    const target = confirming;
    setConfirming(null);
    if (!target) return;
    remove.mutate(target.id, {
      onSuccess: () => toast(COPY.deleted, "info"),
      onError: (error) => toast(getErrorMessage(error, COPY.deleteFailed), "warning"),
    });
  };

  return (
    <View style={styles.card} testID="section-passkeys">
      <View style={styles.header}>
        <ShieldIcon size={20} color={colors.green} />
        <View style={styles.text}>
          <Text style={styles.title}>{COPY.title}</Text>
          <Text style={styles.hint}>{COPY.hint}</Text>
        </View>
      </View>

      {passkeys.isLoading ? (
        <ActivityIndicator color={colors.green} />
      ) : passkeys.isError ? (
        <Text style={styles.note}>{COPY.loadFailed}</Text>
      ) : (passkeys.data ?? []).length === 0 ? (
        <Text style={styles.note}>{COPY.empty}</Text>
      ) : (
        (passkeys.data ?? []).map((p, index) => (
          <View key={p.id} style={[styles.row, index > 0 && styles.divider]}>
            <View style={styles.text}>
              <Text style={styles.name} numberOfLines={1}>
                {p.name}
              </Text>
              <Text style={styles.note}>{usedLine(p)}</Text>
            </View>
            <Pressable
              onPress={() => setConfirming(p)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`${COPY.confirmLabel} ${p.name}`}
              testID="btn-passkey-delete"
            >
              <TrashIcon size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        ))
      )}

      {available && needsProvider ? (
        <PasskeyProviderHelp
          onRetry={add}
          retrying={register.isPending}
          onDismiss={closeProviderHelp}
          stillMissing={providerStillMissing}
        />
      ) : available ? (
        <PillButton
          label={COPY.add}
          variant="outline"
          icon={<PlusIcon size={16} color={colors.textPrimary} />}
          onPress={add}
          loading={register.isPending}
          testID="btn-passkey-add"
        />
      ) : (
        <Text style={styles.note}>{COPY.unsupported}</Text>
      )}

      <ConfirmDialog
        visible={confirming !== null}
        title={COPY.confirmTitle}
        message={confirmMessage(confirming?.name ?? "")}
        confirmLabel={COPY.confirmLabel}
        cancelLabel="Giữ lại"
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(null)}
        loading={remove.isPending}
        testID="dialog-passkey-delete"
      />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  card: {
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
  },
  header: { flexDirection: "row", gap: spacing.md },
  text: { flex: 1, gap: spacing.xs },
  title: { ...typography.body, color: colors.textPrimary },
  hint: { ...typography.caption, color: colors.textSecondary },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingTop: spacing.sm },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceBorder },
  name: { ...typography.body, color: colors.textPrimary },
  note: { ...typography.caption, color: colors.textSecondary },
}));
