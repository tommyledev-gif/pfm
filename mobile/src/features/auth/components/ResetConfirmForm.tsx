import { useRef, useState } from "react";
import { Keyboard, Pressable, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import { PillButton } from "@/components/ui/PillButton";
import { EyeIcon, EyeOffIcon } from "@/components/ui/Icon";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";
import { spacing, createStyles, useColors } from "@/lib/theme";
import { completeLogin } from "@/features/accounts/complete-login";
import { useConfirmPasswordResetMutation } from "@/features/auth/api/use-confirm-password-reset-mutation";
import { AuthField } from "@/features/auth/components/AuthField";
import { AuthFormError } from "@/features/auth/components/AuthFormError";
import { confirmErrorsFor, ConfirmErrors, RESET_COPY, validateNewPassword } from "@/features/auth/password-reset-copy";

interface ResetConfirmFormProps {
  identifier: string;
  /** The code the server accepted on the code step. */
  code: string;
  /** The code stopped working since (expired, ended, replaced): back to it. */
  onCodeRejected: (message: string) => void;
  /** The new password is set and this phone is signed in with it. */
  onDone: () => void;
}

// Step 3 of forgot password: the new password, set with the code checked on
// step 2. Checked here first so a typo never spends one of the code's tries;
// on success the returned pair signs this phone in exactly like a password
// login.
export function ResetConfirmForm({ identifier, code, onCodeRejected, onDone }: ResetConfirmFormProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const confirmReset = useConfirmPasswordResetMutation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<ConfirmErrors>({});
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const focusFirst = (found: ConfirmErrors) => {
    if (found.password) passwordRef.current?.focus();
    else if (found.confirm) confirmRef.current?.focus();
  };

  const submit = () => {
    const found = validateNewPassword(password, confirm);
    setErrors(found);
    if (found.password || found.confirm) return focusFirst(found);
    Keyboard.dismiss();
    confirmReset.mutate(
      { identifier, code, new_password: password },
      {
        onSuccess: async (result) => {
          await completeLogin(result, result.email ?? identifier);
          onDone();
        },
        onError: (error) => {
          const next = confirmErrorsFor(error, password);
          if (next.code) return onCodeRejected(next.code);
          setErrors(next);
          focusFirst(next);
        },
      },
    );
  };

  const edit = (field: keyof ConfirmErrors, set: (value: string) => void) => (value: string) => {
    set(value);
    setErrors((e) => ({ ...e, [field]: undefined, form: undefined }));
  };

  const eye = (
    <Pressable
      onPress={() => setShowPassword((v) => !v)}
      hitSlop={4}
      style={styles.trailing}
      accessibilityRole="button"
      accessibilityLabel={t(showPassword ? RESET_COPY.hidePassword : RESET_COPY.showPassword)}
    >
      {showPassword ? <EyeOffIcon size={22} color={colors.textSecondary} /> : <EyeIcon size={22} color={colors.textSecondary} />}
    </Pressable>
  );

  return (
    <View style={styles.form}>
      <View style={styles.fields}>
        <AuthField
          ref={passwordRef}
          label={t(RESET_COPY.passwordLabel)}
          value={password}
          onChangeText={edit("password", setPassword)}
          error={errors.password}
          placeholder={t(RESET_COPY.passwordPlaceholder, { count: MIN_PASSWORD_LENGTH })}
          secureTextEntry={!showPassword}
          autoComplete="new-password"
          textContentType="newPassword"
          autoFocus
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          submitBehavior="submit"
          trailing={eye}
          testID="input-reset-password"
        />
        <AuthField
          ref={confirmRef}
          label={t(RESET_COPY.confirmLabel)}
          value={confirm}
          onChangeText={edit("confirm", setConfirm)}
          error={errors.confirm}
          secureTextEntry={!showPassword}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={submit}
          testID="input-reset-password-confirm"
        />
      </View>
      <AuthFormError message={errors.form} />
      <PillButton
        label={t(RESET_COPY.submit)}
        loading={confirmReset.isPending}
        onPress={submit}
        style={styles.button}
        textStyle={styles.buttonLabel}
        testID="btn-reset-submit"
      />
    </View>
  );
}

const useStyles = createStyles(() => ({
  form: { width: "100%", gap: spacing.lg },
  fields: { gap: 20 },
  trailing: { width: 48, height: 48, marginRight: 4, alignItems: "center", justifyContent: "center" },
  button: { height: 56, borderRadius: 16, marginTop: spacing.sm },
  buttonLabel: { fontSize: 16 },
}));
