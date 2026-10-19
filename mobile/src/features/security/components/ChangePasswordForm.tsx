import { useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { PillButton } from "@/components/ui/PillButton";
import { getErrorCode, isNetworkError } from "@/lib/api-envelope";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";
import { createStyles, spacing, typography } from "@/lib/theme";
import { useToastStore } from "@/stores/toast-store";
import { AuthField } from "@/features/auth/components/AuthField";
import { useChangePasswordMutation } from "@/features/security/api/use-change-password-mutation";

const COPY = {
  current: "Mật khẩu hiện tại",
  next: "Mật khẩu mới",
  nextHint: `Ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`,
  confirm: "Nhập lại mật khẩu mới",
  submit: "Đổi mật khẩu",
  enterCurrent: "Nhập mật khẩu hiện tại.",
  wrongCurrent: "Mật khẩu hiện tại không đúng.",
  tooShort: `Mật khẩu mới cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`,
  mismatch: "Hai mật khẩu mới chưa khớp.",
  same: "Mật khẩu mới trùng mật khẩu hiện tại.",
  offline: "Không có kết nối mạng. Thử lại sau.",
  rateLimited: "Thử quá nhiều lần. Thử lại sau 15 phút.",
  failed: "Chưa đổi được mật khẩu. Thử lại sau.",
  done: "Đã đổi mật khẩu. Thiết bị khác cần đăng nhập lại.",
} as const;

interface FieldErrors {
  current?: string;
  next?: string;
  confirm?: string;
  form?: string;
}

function validate(current: string, next: string, confirm: string): FieldErrors {
  if (!current) return { current: COPY.enterCurrent };
  if (next.length < MIN_PASSWORD_LENGTH) return { next: COPY.tooShort };
  if (next !== confirm) return { confirm: COPY.mismatch };
  return {};
}

// Server error codes (backend common/password.go, WEAK_PASSWORD) → where the
// sentence goes. Never the server's own message (pfm-ux-copy patterns §4).
function errorsFor(error: unknown): FieldErrors {
  if (isNetworkError(error)) return { form: COPY.offline };
  switch (getErrorCode(error)) {
    case "WRONG_CURRENT_PASSWORD":
      return { current: COPY.wrongCurrent };
    case "WEAK_PASSWORD":
      return { next: COPY.tooShort };
    case "SAME_PASSWORD":
      return { next: COPY.same };
    case "RATE_LIMITED":
      return { form: COPY.rateLimited };
    default:
      return { form: COPY.failed };
  }
}

/**
 * Change password (specs/mobile-account-switch US-11). Checked here first so
 * a typo never costs one of the limited tries; the server checks again. On
 * success this device stays signed in and every other one needs the new
 * password.
 */
export function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const styles = useStyles();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const nextRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const change = useChangePasswordMutation();

  const submit = () => {
    if (change.isPending) return;
    const found = validate(current, next, confirm);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (next === current) {
      setErrors({ next: COPY.same });
      return;
    }
    change.mutate(
      { current_password: current, new_password: next },
      {
        onSuccess: () => {
          useToastStore.getState().show(COPY.done, "info");
          onDone();
        },
        onError: (error) => setErrors(errorsFor(error)),
      },
    );
  };

  return (
    <View style={styles.form}>
      <AuthField
        label={COPY.current}
        value={current}
        onChangeText={setCurrent}
        error={errors.current}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="next"
        onSubmitEditing={() => nextRef.current?.focus()}
        testID="input-current-password"
      />
      <View style={styles.withHint}>
        <AuthField
          ref={nextRef}
          label={COPY.next}
          value={next}
          onChangeText={setNext}
          error={errors.next}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          testID="input-new-password"
        />
        {errors.next ? null : <Text style={styles.hint}>{COPY.nextHint}</Text>}
      </View>
      <AuthField
        ref={confirmRef}
        label={COPY.confirm}
        value={confirm}
        onChangeText={setConfirm}
        error={errors.confirm}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={submit}
        testID="input-confirm-password"
      />
      {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}
      <PillButton label={COPY.submit} onPress={submit} loading={change.isPending} testID="btn-change-password" />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  form: { gap: spacing.lg },
  withHint: { gap: spacing.xs },
  hint: { ...typography.caption, color: colors.textSecondary },
  formError: { ...typography.caption, color: colors.peach },
}));
