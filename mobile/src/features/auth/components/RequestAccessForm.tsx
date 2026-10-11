import { useRef, useState } from "react";
import { Keyboard, Text, TextInput, View } from "react-native";

import { PillButton } from "@/components/ui/PillButton";
import { getErrorCode, getErrorMessage } from "@/lib/axios";
import { isNetworkError } from "@/lib/api-envelope";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles } from "@/lib/theme";
import { AuthField } from "@/features/auth/components/AuthField";
import { useRequestAccessMutation } from "@/features/auth/api/use-request-access-mutation";

type Field = "email" | "adminEmail";
type FieldErrors = Partial<Record<Field, string>>;

const COPY = {
  emailLabel: "Email của bạn",
  emailPlaceholder: "ten@email.com",
  adminLabel: "Email admin",
  adminPlaceholder: "admin@email.com",
  submit: "Gửi yêu cầu",
  emptyEmail: "Nhập email.",
  badEmail: "Nhập email đúng dạng ten@email.com.",
  sameEmail: "Email admin phải khác email của bạn.",
  failed: "Chưa gửi được yêu cầu. Thử lại.",
} as const;

// Server failures that belong to one field; the rest show above the button.
const FIELD_ERROR_BY_CODE: Record<string, { field: Field; message: string }> = {
  ADMIN_NOT_FOUND: { field: "adminEmail", message: "Không có admin nào dùng email này." },
};
const FORM_ERROR_BY_CODE: Record<string, string> = {
  // AccessRequestRateLimiter: 5 per hour per network.
  RATE_LIMITED: "Đã gửi quá nhiều yêu cầu. Thử lại sau 1 giờ.",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailProblem(value: string): string | undefined {
  if (!value) return COPY.emptyEmail;
  if (!EMAIL_PATTERN.test(value)) return COPY.badEmail;
  return undefined;
}

function validate(email: string, adminEmail: string): FieldErrors {
  const errors: FieldErrors = { email: emailProblem(email), adminEmail: emailProblem(adminEmail) };
  if (!errors.email && !errors.adminEmail && email.toLowerCase() === adminEmail.toLowerCase()) {
    errors.adminEmail = COPY.sameEmail;
  }
  return errors;
}

interface RequestAccessFormProps {
  /** Called with the requester's email once the server took the request. */
  onSent: (email: string) => void;
}

// Asks an admin for an account. Each field checks itself when left (and again
// on every keystroke after that, so the red clears as soon as it is fixed);
// submitting checks both and focuses the first one to fix.
export function RequestAccessForm({ onSent }: RequestAccessFormProps) {
  const styles = useStyles();
  const request = useRequestAccessMutation();
  const [email, setEmail] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const emailRef = useRef<TextInput>(null);
  const adminRef = useRef<TextInput>(null);

  const recheck = (field: Field, nextEmail: string, nextAdmin: string) => {
    setErrors((current) => ({ ...current, [field]: validate(nextEmail.trim(), nextAdmin.trim())[field] }));
  };

  const onChange = (field: Field, value: string) => {
    const nextEmail = field === "email" ? value : email;
    const nextAdmin = field === "adminEmail" ? value : adminEmail;
    if (field === "email") setEmail(value);
    else setAdminEmail(value);
    setFormError(null);
    if (touched[field]) recheck(field, nextEmail, nextAdmin);
  };

  const onLeave = (field: Field) => {
    const value = field === "email" ? email : adminEmail;
    // Leaving a field empty is not an error yet; submitting is.
    if (!value.trim()) return;
    setTouched((t) => ({ ...t, [field]: true }));
    recheck(field, email, adminEmail);
  };

  const submit = () => {
    const trimmedEmail = email.trim();
    const trimmedAdmin = adminEmail.trim();
    const found = validate(trimmedEmail, trimmedAdmin);
    setTouched({ email: true, adminEmail: true });
    setErrors(found);
    setFormError(null);
    if (found.email) return emailRef.current?.focus();
    if (found.adminEmail) return adminRef.current?.focus();

    Keyboard.dismiss();
    request.mutate(
      { email: trimmedEmail, admin_email: trimmedAdmin },
      {
        onSuccess: () => onSent(trimmedEmail),
        onError: (error) => {
          if (isNetworkError(error)) return setFormError(getErrorMessage(error, COPY.failed));
          const code = getErrorCode(error) ?? "";
          const fieldError = FIELD_ERROR_BY_CODE[code];
          if (fieldError) {
            setErrors((current) => ({ ...current, [fieldError.field]: fieldError.message }));
            adminRef.current?.focus();
            return;
          }
          setFormError(FORM_ERROR_BY_CODE[code] ?? COPY.failed);
        },
      },
    );
  };

  return (
    <View style={styles.form}>
      <View style={styles.fields}>
        <AuthField
          ref={emailRef}
          label={COPY.emailLabel}
          value={email}
          onChangeText={(v) => onChange("email", v)}
          onBlur={() => onLeave("email")}
          error={errors.email}
          placeholder={COPY.emailPlaceholder}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => adminRef.current?.focus()}
          submitBehavior="submit"
          testID="input-request-email"
        />
        <AuthField
          ref={adminRef}
          label={COPY.adminLabel}
          value={adminEmail}
          onChangeText={(v) => onChange("adminEmail", v)}
          onBlur={() => onLeave("adminEmail")}
          error={errors.adminEmail}
          placeholder={COPY.adminPlaceholder}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="off"
          returnKeyType="send"
          onSubmitEditing={submit}
          testID="input-request-admin-email"
        />
      </View>
      {formError ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{formError}</Text>
        </View>
      ) : null}
      <PillButton
        label={COPY.submit}
        loading={request.isPending}
        onPress={submit}
        style={styles.button}
        textStyle={styles.buttonLabel}
        testID="btn-request-access-submit"
      />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  form: { width: "100%", gap: spacing.lg },
  fields: { gap: 20 },
  button: { height: 56, borderRadius: 16, marginTop: spacing.sm },
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
