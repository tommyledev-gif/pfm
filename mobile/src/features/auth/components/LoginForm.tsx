import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { PillButton } from "@/components/ui/PillButton";
import { getErrorMessage } from "@/lib/axios";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { useLoginMutation } from "@/features/auth/api/use-login-mutation";

export function LoginForm() {
  const [email, setEmail] = useState("admin@pfm.local");
  const [password, setPassword] = useState("DevAdmin@123");
  const login = useLoginMutation();

  return (
    <View style={styles.form}>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        style={styles.input}
      />
      {login.isError ? (
        <Text style={styles.error}>{getErrorMessage(login.error, "Login failed")}</Text>
      ) : null}
      <PillButton
        label="Log In"
        loading={login.isPending}
        disabled={!email || !password}
        onPress={() => login.mutate({ email, password })}
        style={styles.button}
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
  button: { marginTop: spacing.sm },
  error: { color: colors.peach, ...typography.caption },
});
