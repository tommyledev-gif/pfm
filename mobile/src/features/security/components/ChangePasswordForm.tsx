import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TextInput, View } from "react-native";

import { ListSection, ListTextField } from "@/components/ui/grouped-list";
import { PillButton } from "@/components/ui/PillButton";
import { getErrorCode, isNetworkError } from "@/lib/api-envelope";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";
import { copyOf, i18n } from "@/lib/i18n";
import { createStyles, spacing } from "@/lib/theme";
import { useToastStore } from "@/stores/toast-store";
import { useChangePasswordMutation } from "@/features/security/api/use-change-password-mutation";

const COPY = copyOf({
  current: "security.changePassword.current",
  next: "common.field.newPassword",
  confirm: "common.field.confirmNewPassword",
  submit: "security.changePassword.submit",
  enterCurrent: "security.changePassword.enterCurrent",
  wrongCurrent: "security.changePassword.wrongCurrent",
  mismatch: "security.changePassword.mismatch",
  same: "security.changePassword.same",
  offline: "security.changePassword.offline",
  failed: "security.changePassword.failed",
  done: "security.changePassword.done",
});
const tooShort = () => i18n.t("security.changePassword.tooShort", { min: MIN_PASSWORD_LENGTH });
const nextHint = () => i18n.t("security.changePassword.hint", { min: MIN_PASSWORD_LENGTH });
// The password screens' limit window (backend password-change rate limit).
const RATE_LIMIT_MINUTES = 15;

interface FieldErrors {
  current?: string;
  next?: string;
  confirm?: string;
  form?: string;
}

function validate(current: string, next: string, confirm: string): FieldErrors {
  if (!current) return { current: COPY.enterCurrent };
  if (next.length < MIN_PASSWORD_LENGTH) return { next: tooShort() };
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
      return { next: tooShort() };
    case "SAME_PASSWORD":
      return { next: COPY.same };
    case "RATE_LIMITED":
      return { form: i18n.t("errors.tooManyAttempts", { minutes: RATE_LIMIT_MINUTES }) };
    default:
      return { form: COPY.failed };
  }
}

/**
 * Change password (specs/mobile-account-switch US-11). Checked here first so
 * a typo never costs one of the limited tries; the server checks again. On
 * success this device stays signed in and every other one needs the new
 * password.
 *
 * The three fields are one group (hairlines between, no box around each);
 * the one sentence that matters (the error, or the length rule) is the
 * group's footer, and the field it is about has a red label.
 */
export function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  useTranslation(); // COPY reads the current language: re-render on a switch
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

  // validate() and errorsFor() report one problem at a time.
  const errorLine = errors.current ?? errors.next ?? errors.confirm ?? errors.form;

  return (
    <View style={styles.form}>
      <ListSection footer={errorLine ?? nextHint()} footerTone={errorLine ? "danger" : "default"}>
        <ListTextField
          label={COPY.current}
          value={current}
          onChangeText={setCurrent}
          invalid={Boolean(errors.current)}
          error={errors.current}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="next"
          onSubmitEditing={() => nextRef.current?.focus()}
          testID="input-current-password"
        />
        <ListTextField
          ref={nextRef}
          label={COPY.next}
          value={next}
          onChangeText={setNext}
          invalid={Boolean(errors.next)}
          error={errors.next}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          testID="input-new-password"
        />
        <ListTextField
          ref={confirmRef}
          label={COPY.confirm}
          value={confirm}
          onChangeText={setConfirm}
          invalid={Boolean(errors.confirm)}
          error={errors.confirm}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={submit}
          testID="input-confirm-password"
        />
      </ListSection>
      <PillButton label={COPY.submit} onPress={submit} loading={change.isPending} testID="btn-change-password" />
    </View>
  );
}

const useStyles = createStyles(() => ({
  form: { gap: spacing.xxl },
}));
