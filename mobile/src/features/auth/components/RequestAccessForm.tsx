import { useRef, useState } from "react";
import { Keyboard, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import { PillButton } from "@/components/ui/PillButton";
import { errorText, getErrorCode } from "@/lib/api-envelope";
import { i18n, TranslationKey } from "@/lib/i18n";
import { spacing, createStyles } from "@/lib/theme";
import { AuthField } from "@/features/auth/components/AuthField";
import { AuthFormError } from "@/features/auth/components/AuthFormError";
import { useRequestAccessMutation } from "@/features/auth/api/use-request-access-mutation";

type Field = "email" | "adminEmail";
type FieldErrors = Partial<Record<Field, string>>;

const COPY = {
  emailLabel: "auth.requestAccess.emailLabel",
  emailPlaceholder: "auth.emailPlaceholder",
  adminLabel: "auth.requestAccess.adminLabel",
  adminPlaceholder: "auth.requestAccess.adminPlaceholder",
  submit: "auth.requestAccess.submit",
  emptyEmail: "auth.requestAccess.emptyEmail",
  badEmail: "auth.requestAccess.badEmail",
  sameEmail: "auth.requestAccess.sameEmail",
  failed: "auth.requestAccess.failed",
} as const satisfies Record<string, TranslationKey>;

// Server failures that belong to one field; the rest show above the button.
const FIELD_ERROR_BY_CODE: Record<string, { field: Field; key: TranslationKey }> = {
  ADMIN_NOT_FOUND: { field: "adminEmail", key: "auth.requestAccess.ADMIN_NOT_FOUND" },
};
// AccessRequestRateLimiter: 5 per hour per network.
const RATE_LIMIT_HOURS = 1;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailProblem(value: string): string | undefined {
  if (!value) return i18n.t(COPY.emptyEmail);
  if (!EMAIL_PATTERN.test(value)) return i18n.t(COPY.badEmail);
  return undefined;
}

function validate(email: string, adminEmail: string): FieldErrors {
  const errors: FieldErrors = { email: emailProblem(email), adminEmail: emailProblem(adminEmail) };
  if (!errors.email && !errors.adminEmail && email.toLowerCase() === adminEmail.toLowerCase()) {
    errors.adminEmail = i18n.t(COPY.sameEmail);
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
  const { t } = useTranslation();
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
          const code = getErrorCode(error) ?? "";
          const fieldError = FIELD_ERROR_BY_CODE[code];
          if (fieldError) {
            setErrors((current) => ({ ...current, [fieldError.field]: t(fieldError.key) }));
            adminRef.current?.focus();
            return;
          }
          if (code === "RATE_LIMITED") {
            setFormError(t("auth.requestAccess.RATE_LIMITED", { count: RATE_LIMIT_HOURS }));
            return;
          }
          setFormError(errorText(error, COPY.failed));
        },
      },
    );
  };

  return (
    <View style={styles.form}>
      <View style={styles.fields}>
        <AuthField
          ref={emailRef}
          label={t(COPY.emailLabel)}
          value={email}
          onChangeText={(v) => onChange("email", v)}
          onBlur={() => onLeave("email")}
          error={errors.email}
          placeholder={t(COPY.emailPlaceholder)}
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
          label={t(COPY.adminLabel)}
          value={adminEmail}
          onChangeText={(v) => onChange("adminEmail", v)}
          onBlur={() => onLeave("adminEmail")}
          error={errors.adminEmail}
          placeholder={t(COPY.adminPlaceholder)}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="off"
          returnKeyType="send"
          onSubmitEditing={submit}
          testID="input-request-admin-email"
        />
      </View>
      <AuthFormError message={formError} />
      <PillButton
        label={t(COPY.submit)}
        loading={request.isPending}
        onPress={submit}
        style={styles.button}
        textStyle={styles.buttonLabel}
        testID="btn-request-access-submit"
      />
    </View>
  );
}

const useStyles = createStyles(() => ({
  form: { width: "100%", gap: spacing.lg },
  fields: { gap: 20 },
  button: { height: 56, borderRadius: 16, marginTop: spacing.sm },
  buttonLabel: { fontSize: 16 },
}));
