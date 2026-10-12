import { useState } from "react";
import { Text, TextInput, View } from "react-native";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PillButton } from "@/components/ui/PillButton";
import { getErrorMessage } from "@/lib/axios";
import { withAlpha } from "@/lib/color";
import { useRequireOnline } from "@/lib/connectivity";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useToastStore } from "@/stores/toast-store";
import { useClaimUsernameMutation } from "@/features/profile/api/use-claim-username-mutation";

// Server rule (common.UsernameMaxLength).
const USERNAME_MAX_LENGTH = 30;

const COPY = {
  label: "Tên đăng nhập",
  placeholder: "vd: lan.nguyen",
  hint: "Đặt một lần, không đổi được.",
  submit: "Đặt tên đăng nhập",
  confirmMessage: "Tên này không đổi được sau khi đặt.",
  confirm: "Đặt tên",
  cancel: "Sửa lại",
  done: "Đã đặt tên đăng nhập",
  failed: "Chưa đặt được tên đăng nhập. Thử lại.",
} as const;

/**
 * For an account activated before tên đăng nhập existed: it signs in by email
 * only until it picks one here. Same rule as the activation page, once and for
 * good, so the choice is confirmed first. EditProfileForm shows this only
 * while the profile has no username; afterwards the read-only value replaces it.
 */
export function UsernameClaimField() {
  const colors = useColors();
  const styles = useStyles();
  const requireOnline = useRequireOnline();
  const claim = useClaimUsernameMutation();
  const [value, setValue] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  // The server stores lowercase; show the name the way it will be kept.
  const username = value.trim().toLowerCase();

  const submit = () => {
    claim.mutate(username, {
      onSuccess: () => {
        setConfirmOpen(false);
        useToastStore.getState().show(COPY.done, "info");
      },
      // The server's message (taken, wrong format) shows under the field.
      onError: () => setConfirmOpen(false),
    });
  };

  return (
    <View style={styles.block} testID="field-profile-claim-username">
      <Text style={styles.label}>{COPY.label}</Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={COPY.placeholder}
        placeholderTextColor={colors.textMuted}
        maxLength={USERNAME_MAX_LENGTH}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        style={styles.input}
        testID="input-profile-username"
      />
      <Text style={styles.hint}>{COPY.hint}</Text>
      {claim.isError ? <Text style={styles.error}>{getErrorMessage(claim.error, COPY.failed)}</Text> : null}
      <PillButton
        label={COPY.submit}
        variant="outline"
        onPress={() => requireOnline(() => setConfirmOpen(true))}
        disabled={username.length === 0 || claim.isPending}
        style={styles.button}
        testID="btn-profile-claim-username"
      />
      <ConfirmDialog
        visible={confirmOpen}
        title={`Đặt tên đăng nhập ${username}?`}
        message={COPY.confirmMessage}
        confirmLabel={COPY.confirm}
        cancelLabel={COPY.cancel}
        onConfirm={() => requireOnline(submit)}
        onCancel={() => setConfirmOpen(false)}
        loading={claim.isPending}
        testID="dialog-profile-claim-username"
      />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  block: { gap: spacing.xs },
  label: { ...typography.caption, color: colors.textSecondary },
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
  hint: { ...typography.tiny, color: colors.textMuted },
  error: { color: colors.peach, ...typography.caption },
  button: { alignSelf: "flex-start", marginTop: spacing.xs },
}));
