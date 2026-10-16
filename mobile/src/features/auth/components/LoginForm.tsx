import { useRef, useState } from "react";
import { Keyboard, Pressable, Text, TextInput, View } from "react-native";

import { PillButton } from "@/components/ui/PillButton";
import { EyeIcon, EyeOffIcon } from "@/components/ui/Icon";
import { withAlpha } from "@/lib/color";
import { DEV_LOGIN } from "@/lib/dev-login";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useLoginMutation } from "@/features/auth/api/use-login-mutation";
import { loginErrorMessage } from "@/features/auth/login-error";
import { completeLogin, LoginOutcome } from "@/features/accounts/complete-login";
import { PasskeySignInButton } from "@/features/auth/components/PasskeySignInButton";

export type LoginFormMode = "login" | "add-account";

interface LoginFormProps {
  /** "add-account" logs a second User in while another is active (US-03). */
  mode?: LoginFormMode;
  /** The email of a saved account (EC-10), a sent request or a test account. */
  initialEmail?: string;
  /** A debug test account's password (lib/dev-login.ts TEST_ACCOUNTS). */
  initialPassword?: string;
  /** Shown but not usable: a sent request no admin has approved yet. */
  disabled?: boolean;
  /**
   * The email is already known and shown above the form (a saved account),
   * so only the password is asked for. Needs `initialEmail`.
   */
  hideEmail?: boolean;
  onDone?: (outcome: LoginOutcome) => void;
}

type Field = "email" | "password";

const SUBMIT_LABEL: Record<LoginFormMode, string> = {
  login: "Đăng nhập",
  "add-account": "Thêm tài khoản",
};

const COPY = {
  // Either one signs in (backend AuthService.Login).
  emailLabel: "Email hoặc tên đăng nhập",
  emailPlaceholder: "ten@email.com",
  passwordLabel: "Mật khẩu",
  passwordPlaceholder: "Nhập mật khẩu",
  showPassword: "Hiện mật khẩu",
  hidePassword: "Ẩn mật khẩu",
} as const;

const FIELD_HEIGHT = 56;
const FIELD_RADIUS = 16;

// Dev builds start filled in with the test account (lib/dev-login.ts); its
// password only goes with its own email, never a saved account being renewed.
function initialFields(
  initialEmail: string | undefined,
  initialPassword: string | undefined,
): { email: string; password: string } {
  const email = initialEmail ?? DEV_LOGIN?.email ?? "";
  if (initialPassword !== undefined) return { email, password: initialPassword };
  return { email, password: DEV_LOGIN && email === DEV_LOGIN.email ? DEV_LOGIN.password : "" };
}


// Labelled fields over a full-width primary button. The field being typed in
// carries the accent border, so it is clear where the keyboard is writing.
export function LoginForm({
  mode = "login",
  initialEmail,
  initialPassword,
  disabled = false,
  hideEmail = false,
  onDone,
}: LoginFormProps) {
  const colors = useColors();
  const styles = useStyles();
  const [initial] = useState(() => initialFields(initialEmail, initialPassword));
  const [email, setEmail] = useState(initial.email);
  const [password, setPassword] = useState(initial.password);
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<Field | null>(null);
  const login = useLoginMutation();
  const passwordRef = useRef<TextInput>(null);

  const submit = () => {
    const identifier = email.trim();
    if (disabled || !identifier || !password) return;
    login.mutate(
      { email: identifier, password },
      // The account's own email, not what was typed: a tên đăng nhập works
      // for signing in, but the device remembers the account by its email.
      { onSuccess: async (result) => onDone?.(await completeLogin(result, result.email ?? identifier)) },
    );
  };

  const focusProps = (field: Field) => ({
    onFocus: () => setFocused(field),
    onBlur: () => setFocused((current) => (current === field ? null : current)),
  });

  return (
    <View style={styles.form}>
      <View style={styles.fields}>
        {hideEmail ? null : (
          <View style={styles.field}>
            <Text style={styles.label}>{COPY.emailLabel}</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={COPY.emailPlaceholder}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="username"
              // "Next" jumps straight to the password, the only field after it.
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              submitBehavior="submit"
              accessibilityLabel={COPY.emailLabel}
              style={[styles.box, styles.input, focused === "email" && styles.boxFocused]}
              testID="input-login-email"
              {...focusProps("email")}
            />
          </View>
        )}
        <View style={styles.field}>
          <Text style={styles.label}>{COPY.passwordLabel}</Text>
          <View style={[styles.box, styles.passwordRow, focused === "password" && styles.boxFocused]}>
            <TextInput
              ref={passwordRef}
              value={password}
              onChangeText={setPassword}
              placeholder={COPY.passwordPlaceholder}
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showPassword}
              autoComplete="current-password"
              textContentType="password"
              autoFocus={hideEmail && !disabled}
              editable={!disabled}
              // "Done" is the last field's submit: it closes the keyboard and logs in.
              returnKeyType="done"
              onSubmitEditing={() => {
                Keyboard.dismiss();
                submit();
              }}
              accessibilityLabel={COPY.passwordLabel}
              style={[styles.input, styles.passwordInput]}
              testID="input-login-password"
              {...focusProps("password")}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={4}
              style={styles.eyeButton}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? COPY.hidePassword : COPY.showPassword}
            >
              {showPassword ? (
                <EyeOffIcon size={22} color={colors.textSecondary} />
              ) : (
                <EyeIcon size={22} color={colors.textSecondary} />
              )}
            </Pressable>
          </View>
        </View>
      </View>
      {login.isError ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{loginErrorMessage(login.error)}</Text>
        </View>
      ) : null}
      <PillButton
        label={SUBMIT_LABEL[mode]}
        loading={login.isPending}
        disabled={disabled || !email || !password}
        onPress={submit}
        style={[styles.button, hideEmail ? styles.buttonTight : styles.buttonLoose]}
        textStyle={styles.buttonLabel}
        testID="btn-login-submit"
      />
      {/* Any account whose passkey is on this phone — not tied to the email typed. */}
      {hideEmail ? null : <PasskeySignInButton disabled={disabled} onDone={onDone} />}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  form: { width: "100%", gap: spacing.lg },
  fields: { gap: 20 },
  field: { gap: spacing.sm },
  label: { ...typography.label, fontWeight: "500", color: colors.textSecondary },
  box: {
    height: FIELD_HEIGHT,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    borderRadius: FIELD_RADIUS,
  },
  boxFocused: { borderColor: colors.green },
  input: {
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary,
    fontSize: 17,
  },
  passwordRow: { flexDirection: "row", alignItems: "center", paddingRight: 4 },
  passwordInput: { flex: 1, height: "100%" },
  eyeButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  button: { height: FIELD_HEIGHT, borderRadius: FIELD_RADIUS },
  // A lone password field sits close to its button; a two-field form gets air.
  buttonTight: { marginTop: 0 },
  buttonLoose: { marginTop: spacing.sm },
  buttonLabel: { fontSize: 16 },
  errorBox: {
    backgroundColor: withAlpha(colors.peach, 0.12),
    borderWidth: 1,
    borderColor: withAlpha(colors.peach, 0.35),
    borderRadius: radii.listCard,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  error: { color: colors.peach, ...typography.caption },
}));
