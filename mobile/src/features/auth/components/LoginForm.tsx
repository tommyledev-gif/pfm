import { useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { PillButton } from "@/components/ui/PillButton";
import { EyeIcon, EyeOffIcon } from "@/components/ui/Icon";
import { getErrorMessage } from "@/lib/axios";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { useLoginMutation } from "@/features/auth/api/use-login-mutation";

// Backend error messages are lowercase sentence fragments (e.g. "invalid
// email or password" — backend/internal/common/errors.go) meant to be
// embedded in JSON, not shown verbatim as UI copy.
function capitalize(text: string): string {
  return text.length ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export function LoginForm() {
  const [email, setEmail] = useState("owner@example.com");
  const [password, setPassword] = useState("000000");
  const [showPassword, setShowPassword] = useState(false);
  const login = useLoginMutation();
  const passwordRef = useRef<TextInput>(null);

  const submit = () => {
    if (!email || !password) return;
    login.mutate({ email, password });
  };

  return (
    <View style={styles.form}>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        // "Next" (rather than the default "return", which does nothing but
        // insert a newline) both reads as "input done here" and jumps
        // straight to Password — matches the two-field email→password flow
        // this form is always used for.
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        blurOnSubmit={false}
        style={styles.input}
      />
      <View style={styles.passwordRow}>
        <TextInput
          ref={passwordRef}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry={!showPassword}
          // "Done" both dismisses the keyboard on submit and, since it's the
          // last field, doubles as the login action.
          returnKeyType="done"
          onSubmitEditing={() => {
            Keyboard.dismiss();
            submit();
          }}
          style={styles.passwordInput}
        />
        <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8} style={styles.eyeButton}>
          {showPassword ? (
            <EyeOffIcon size={20} color={colors.textSecondary} />
          ) : (
            <EyeIcon size={20} color={colors.textSecondary} />
          )}
        </Pressable>
      </View>
      {login.isError ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{capitalize(getErrorMessage(login.error, "Login failed"))}</Text>
        </View>
      ) : null}
      <PillButton
        label="Log In"
        loading={login.isPending}
        variant="outline"
        disabled={!email || !password}
        onPress={submit}
        style={styles.button}
        textStyle={{color: colors.green}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { width: "100%", gap: spacing.md },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    color: colors.textPrimary,
    ...typography.body,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    paddingRight: spacing.md,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    color: colors.textPrimary,
    ...typography.body,
  },
  eyeButton: { padding: spacing.xs },
  button: { marginTop: spacing.sm, backgroundColor: colors.greenDark },
  errorBox: {
    backgroundColor: "rgba(255,158,150,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,158,150,0.35)",
    borderRadius: radii.listCard,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  error: { color: colors.peach, ...typography.caption },
});
