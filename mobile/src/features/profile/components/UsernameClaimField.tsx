import { useState } from "react";
import { View } from "react-native";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { InlineActionField } from "@/components/shared/InlineActionField";
import { getErrorMessage } from "@/lib/axios";
import { useRequireOnline } from "@/lib/connectivity";
import { useToastStore } from "@/stores/toast-store";
import { useClaimUsernameMutation } from "@/features/profile/api/use-claim-username-mutation";

// Server rule (common.UsernameMaxLength).
const USERNAME_MAX_LENGTH = 30;

const COPY = {
  label: "Tên đăng nhập",
  placeholder: "vd: lan.nguyen",
  hint: "Đặt một lần, không đổi được.",
  // Short: it sits inside the field, beside what is typed.
  submit: "Đặt",
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
    <View testID="field-profile-claim-username">
      {/* Name and its button on one row: the button sits inside the field. */}
      <InlineActionField
        label={COPY.label}
        value={value}
        onChangeText={setValue}
        placeholder={COPY.placeholder}
        maxLength={USERNAME_MAX_LENGTH}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        actionLabel={COPY.submit}
        onAction={() => requireOnline(() => setConfirmOpen(true))}
        actionEnabled={username.length > 0}
        loading={claim.isPending}
        hint={COPY.hint}
        error={claim.isError ? getErrorMessage(claim.error, COPY.failed) : null}
        testID="input-profile-username"
        actionTestID="btn-profile-claim-username"
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
