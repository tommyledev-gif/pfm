import { useRef, useState } from "react";
import { Keyboard, LayoutAnimation, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { PillButton } from "@/components/ui/PillButton";
import { ArrowRightIcon, EyeIcon, EyeOffIcon, UserIcon } from "@/components/ui/Icon";
import { DEV_LOGIN } from "@/lib/dev-login";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useReduceMotion } from "@/lib/use-reduce-motion";
import { useLoginMutation } from "@/features/auth/api/use-login-mutation";
import { loginErrorMessage } from "@/features/auth/login-error";
import { completeLogin, LoginOutcome } from "@/features/accounts/complete-login";
import { AuthField } from "@/features/auth/components/AuthField";
import { AuthFormError } from "@/features/auth/components/AuthFormError";

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

// Who first, then the password: one field and one green button at a time.
type Step = "identifier" | "password";
type FieldErrors = Partial<Record<"email" | "password", string>>;

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
  next: "Tiếp tục",
  forgotPassword: "Quên mật khẩu?",
  emailMissing: "Nhập email hoặc tên đăng nhập.",
  passwordMissing: "Nhập mật khẩu.",
} as const;

const FIELD_HEIGHT = 56;
const FIELD_RADIUS = 16;
// The password field fades in while the button under it slides down.
const REVEAL_ANIMATION = LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity);

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
//
// The button is never dimmed for an empty field: a pale green button read as
// broken. Pressed too early, it says what is missing under that field.
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
  const router = useRouter();
  const reduceMotion = useReduceMotion();
  const [initial] = useState(() => initialFields(initialEmail, initialPassword));
  const [email, setEmail] = useState(initial.email);
  const [password, setPassword] = useState(initial.password);
  // Whoever is signing in is already known (a saved account, an expired one
  // being renewed, a filled-in test account): straight to the password.
  const [step, setStep] = useState<Step>(() =>
    hideEmail || initialEmail || initial.password ? "password" : "identifier",
  );
  // Set by Tiếp tục, so the password field it reveals takes the keyboard.
  const [revealed, setRevealed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const login = useLoginMutation();
  const passwordRef = useRef<TextInput>(null);

  // Nothing is sent at this step, so it never says whether an account exists.
  const advance = () => {
    if (!email.trim()) {
      setErrors({ email: COPY.emailMissing });
      return;
    }
    if (!reduceMotion) LayoutAnimation.configureNext(REVEAL_ANIMATION);
    setRevealed(true);
    setStep("password");
  };

  const submit = () => {
    if (disabled) return;
    const identifier = email.trim();
    const missing: FieldErrors = {
      email: identifier ? undefined : COPY.emailMissing,
      password: password ? undefined : COPY.passwordMissing,
    };
    setErrors(missing);
    if (missing.email || missing.password) return;
    login.mutate(
      { email: identifier, password },
      // The account's own email, not what was typed: a tên đăng nhập works
      // for signing in, but the device remembers the account by its email.
      { onSuccess: async (result) => onDone?.(await completeLogin(result, result.email ?? identifier)) },
    );
  };

  const changeEmail = (value: string) => {
    setEmail(value);
    setErrors((e) => ({ ...e, email: undefined }));
  };
  const changePassword = (value: string) => {
    setPassword(value);
    setErrors((e) => ({ ...e, password: undefined }));
  };

  const atIdentifier = step === "identifier";
  // Signed out only: "+ Thêm tài khoản" runs inside a session, where the
  // reset screen (an auth route) cannot open.
  const canReset = mode === "login" && !disabled && !atIdentifier;
  const forgotPassword = () =>
    router.push({ pathname: "/reset-password", params: { identifier: email.trim() } });

  return (
    <View style={styles.form}>
      <View style={styles.fields}>
        {hideEmail ? null : (
          <AuthField
            label={COPY.emailLabel}
            value={email}
            onChangeText={changeEmail}
            error={errors.email}
            placeholder={COPY.emailPlaceholder}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="username"
            // "Next" is Tiếp tục until the password shows, then moves to it.
            returnKeyType="next"
            onSubmitEditing={atIdentifier ? advance : () => passwordRef.current?.focus()}
            submitBehavior="submit"
            trailing={
              <View style={styles.trailing} importantForAccessibility="no-hide-descendants">
                <UserIcon size={22} color={colors.textMuted} />
              </View>
            }
            testID="input-login-email"
          />
        )}
        {atIdentifier ? null : (
          <AuthField
            ref={passwordRef}
            label={COPY.passwordLabel}
            value={password}
            onChangeText={changePassword}
            error={errors.password}
            placeholder={COPY.passwordPlaceholder}
            secureTextEntry={!showPassword}
            autoComplete="current-password"
            textContentType="password"
            autoFocus={revealed || (hideEmail && !disabled)}
            editable={!disabled}
            // "Done" is the last field's submit: it closes the keyboard and logs in.
            returnKeyType="done"
            onSubmitEditing={() => {
              Keyboard.dismiss();
              submit();
            }}
            trailing={
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={4}
                style={styles.trailing}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? COPY.hidePassword : COPY.showPassword}
              >
                {showPassword ? (
                  <EyeOffIcon size={22} color={colors.textSecondary} />
                ) : (
                  <EyeIcon size={22} color={colors.textSecondary} />
                )}
              </Pressable>
            }
            testID="input-login-password"
          />
        )}
        {canReset ? (
          <Pressable
            onPress={forgotPassword}
            hitSlop={8}
            style={styles.forgot}
            accessibilityRole="button"
            testID="btn-login-forgot-password"
          >
            <Text style={styles.forgotLabel}>{COPY.forgotPassword}</Text>
          </Pressable>
        ) : null}
      </View>
      <AuthFormError message={login.isError ? loginErrorMessage(login.error) : null} />
      <PillButton
        label={atIdentifier ? COPY.next : SUBMIT_LABEL[mode]}
        icon={atIdentifier ? <ArrowRightIcon size={20} color={colors.onGreen} /> : undefined}
        iconPosition="end"
        loading={login.isPending}
        disabled={disabled}
        onPress={atIdentifier ? advance : submit}
        style={[styles.button, hideEmail ? styles.buttonTight : styles.buttonLoose]}
        textStyle={styles.buttonLabel}
        testID={atIdentifier ? "btn-login-next" : "btn-login-submit"}
      />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  form: { width: "100%", gap: spacing.lg },
  fields: { gap: 20 },
  // Inside the field's box, at its right edge: the person icon or the eye.
  trailing: { width: 48, height: 48, marginRight: 4, alignItems: "center", justifyContent: "center" },
  button: { height: FIELD_HEIGHT, borderRadius: FIELD_RADIUS },
  // A lone password field sits close to its button; a two-field form gets air.
  buttonTight: { marginTop: 0 },
  buttonLoose: { marginTop: spacing.sm },
  buttonLabel: { fontSize: 16 },
  // Right under the password field, at its right edge, pulled into the gap.
  forgot: { alignSelf: "flex-end", marginTop: -spacing.sm, paddingVertical: 2 },
  forgotLabel: { ...typography.label, fontWeight: "600", color: colors.green },
}));
