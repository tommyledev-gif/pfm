import { useRef, useState } from "react";
import { Keyboard, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import { PillButton } from "@/components/ui/PillButton";
import { PASSWORD_RESET_CODE_LENGTH } from "@/lib/constants";
import { spacing, createStyles } from "@/lib/theme";
import { useVerifyPasswordResetMutation } from "@/features/auth/api/use-verify-password-reset-mutation";
import { AuthField } from "@/features/auth/components/AuthField";
import { AuthFormError } from "@/features/auth/components/AuthFormError";
import { ResendCodeLink } from "@/features/auth/components/ResendCodeLink";
import { CodeErrors, codeProblem, RESET_COPY, verifyErrorsFor } from "@/features/auth/password-reset-copy";

interface ResetCodeFormProps {
  identifier: string;
  /** The code typed before, when coming back from the password step. */
  initialCode: string;
  /** Why the password step sent the User back (the code stopped working). */
  initialError?: string;
  sentAt: number;
  onResent: (at: number) => void;
  /** The server accepted the code: move on to the new password. */
  onVerified: (code: string) => void;
}

// Step 2 of forgot password: the emailed code, checked by the server before
// the new password is asked for. A short code is caught here first, so it
// never spends one of the code's 5 tries.
export function ResetCodeForm({ identifier, initialCode, initialError, sentAt, onResent, onVerified }: ResetCodeFormProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const verify = useVerifyPasswordResetMutation();
  const [code, setCode] = useState(initialCode);
  const [errors, setErrors] = useState<CodeErrors>({ code: initialError });
  const codeRef = useRef<TextInput>(null);

  const submit = () => {
    const problem = codeProblem(code);
    setErrors({ code: problem });
    if (problem) return codeRef.current?.focus();
    Keyboard.dismiss();
    verify.mutate(
      { identifier, code },
      {
        onSuccess: () => onVerified(code),
        onError: (error) => {
          const next = verifyErrorsFor(error);
          setErrors(next);
          if (next.code) codeRef.current?.focus();
        },
      },
    );
  };

  return (
    <View style={styles.form}>
      <AuthField
        ref={codeRef}
        label={t(RESET_COPY.codeLabel)}
        value={code}
        onChangeText={(value) => {
          setCode(value.replace(/[^0-9]/g, ""));
          setErrors({});
        }}
        error={errors.code}
        placeholder={t(RESET_COPY.codePlaceholder, { length: PASSWORD_RESET_CODE_LENGTH })}
        keyboardType="number-pad"
        maxLength={PASSWORD_RESET_CODE_LENGTH}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        autoFocus
        returnKeyType="done"
        onSubmitEditing={submit}
        testID="input-reset-code"
      />
      <AuthFormError message={errors.form} />
      <PillButton
        label={t(RESET_COPY.checkCode)}
        loading={verify.isPending}
        onPress={submit}
        style={styles.button}
        textStyle={styles.buttonLabel}
        testID="btn-reset-check-code"
      />
      <ResendCodeLink
        identifier={identifier}
        sentAt={sentAt}
        onSent={onResent}
        onError={(message) => setErrors((e) => ({ ...e, form: message ?? undefined }))}
      />
    </View>
  );
}

const useStyles = createStyles(() => ({
  form: { width: "100%", gap: spacing.lg },
  button: { height: 56, borderRadius: 16, marginTop: spacing.sm },
  buttonLabel: { fontSize: 16 },
}));
