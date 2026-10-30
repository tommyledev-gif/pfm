import { useState } from "react";
import { Keyboard, View } from "react-native";
import { useTranslation } from "react-i18next";

import { PillButton } from "@/components/ui/PillButton";
import { UserIcon } from "@/components/ui/Icon";
import { spacing, createStyles, useColors } from "@/lib/theme";
import { useRequestPasswordResetMutation } from "@/features/auth/api/use-request-password-reset-mutation";
import { AuthField } from "@/features/auth/components/AuthField";
import { AuthFormError } from "@/features/auth/components/AuthFormError";
import { identifierProblem, requestErrorMessage, RESET_COPY } from "@/features/auth/password-reset-copy";

interface ResetRequestFormProps {
  /** What the login screen had typed, carried over. */
  initialIdentifier: string;
  /** The server took the request: move on to the code. */
  onSent: (identifier: string) => void;
}

// Step 1 of forgot password: who. The answer is the same for every
// identifier, so moving on never says whether an account exists.
export function ResetRequestForm({ initialIdentifier, onSent }: ResetRequestFormProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const request = useRequestPasswordResetMutation();
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [fieldError, setFieldError] = useState<string>();

  const submit = () => {
    const trimmed = identifier.trim();
    const problem = identifierProblem(trimmed);
    setFieldError(problem);
    if (problem) return;
    Keyboard.dismiss();
    request.mutate({ identifier: trimmed }, { onSuccess: () => onSent(trimmed) });
  };

  return (
    <View style={styles.form}>
      <AuthField
        label={t(RESET_COPY.identifierLabel)}
        value={identifier}
        onChangeText={(value) => {
          setIdentifier(value);
          setFieldError(undefined);
          request.reset();
        }}
        error={fieldError}
        placeholder={t(RESET_COPY.identifierPlaceholder)}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="username"
        autoFocus={!initialIdentifier}
        returnKeyType="send"
        onSubmitEditing={submit}
        trailing={
          <View style={styles.trailing} importantForAccessibility="no-hide-descendants">
            <UserIcon size={22} color={colors.textMuted} />
          </View>
        }
        testID="input-reset-identifier"
      />
      <AuthFormError message={request.isError ? requestErrorMessage(request.error) : null} />
      <PillButton
        label={t(RESET_COPY.sendCode)}
        loading={request.isPending}
        onPress={submit}
        style={styles.button}
        textStyle={styles.buttonLabel}
        testID="btn-reset-send-code"
      />
    </View>
  );
}

const useStyles = createStyles(() => ({
  form: { width: "100%", gap: spacing.lg },
  trailing: { width: 48, height: 48, marginRight: 4, alignItems: "center", justifyContent: "center" },
  button: { height: 56, borderRadius: 16, marginTop: spacing.sm },
  buttonLabel: { fontSize: 16 },
}));
