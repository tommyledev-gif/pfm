import { errorText, getErrorCode, isNetworkError } from "@/lib/api-envelope";
import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH, PASSWORD_RESET_CODE_LENGTH } from "@/lib/constants";
import { i18n, TranslationKey } from "@/lib/i18n";
import { passwordLengthProblem } from "@/lib/password-rules";

// The code's lifetime and the rate limits' window (backend common.ResetCodeTTL,
// PasswordResetRequest/ConfirmRateLimitWindow): not sent with the answer, so
// said from here.
const RESET_WINDOW_MINUTES = 15;

// Forgot password (specs/forgot-password §UI copy). Keys, passed to t() where
// shown; codePlaceholder takes {{length}}, passwordPlaceholder {{count}}.
export const RESET_COPY = {
  title: "auth.resetPassword.title",
  requestSub: "auth.resetPassword.requestSub",
  identifierLabel: "common.field.identifier",
  identifierPlaceholder: "auth.emailPlaceholder",
  sendCode: "auth.resetPassword.sendCode",
  codeLabel: "auth.resetPassword.codeLabel",
  codePlaceholder: "auth.resetPassword.codePlaceholder",
  checkCode: "common.action.continue",
  passwordSub: "auth.resetPassword.passwordSub",
  passwordLabel: "common.field.newPassword",
  passwordPlaceholder: "auth.resetPassword.passwordPlaceholder",
  confirmLabel: "common.field.confirmNewPassword",
  showPassword: "common.action.showPassword",
  hidePassword: "common.action.hidePassword",
  submit: "auth.resetPassword.submit",
  resend: "auth.resetPassword.resend",
  back: "common.action.back",
  done: "auth.resetPassword.done",
} as const satisfies Record<string, TranslationKey>;

/** The code step's line under the title. Never says whether the account exists. */
export function confirmSub(identifier: string): string {
  return i18n.t("auth.resetPassword.confirmSub", {
    identifier,
    length: PASSWORD_RESET_CODE_LENGTH,
    minutes: RESET_WINDOW_MINUTES,
  });
}

export function resendIn(seconds: number): string {
  return i18n.t("auth.resetPassword.resendIn", { count: seconds });
}

const CODE_PATTERN = new RegExp(`^[0-9]{${PASSWORD_RESET_CODE_LENGTH}}$`);

// Sentences are read when the problem is found, in the language of the moment.
export function identifierProblem(identifier: string): string | undefined {
  return identifier ? undefined : i18n.t("common.validation.enterIdentifier");
}

/** The code step's errors. */
export interface CodeErrors {
  code?: string;
  form?: string;
}

/** The password step's errors; `code` means the code no longer works. */
export interface ConfirmErrors {
  code?: string;
  password?: string;
  confirm?: string;
  form?: string;
}

function passwordTooLong(): string {
  return i18n.t("auth.password.tooLong", { count: MAX_PASSWORD_BYTES });
}

function passwordProblem(password: string): string | undefined {
  const problem = passwordLengthProblem(password);
  if (problem === "short") return i18n.t("auth.password.tooShort", { count: MIN_PASSWORD_LENGTH });
  if (problem === "long") return passwordTooLong();
  return undefined;
}

/** Checked before the code is sent, so a short code never spends a try. */
export function codeProblem(code: string): string | undefined {
  return CODE_PATTERN.test(code) ? undefined : i18n.t("auth.resetPassword.codeMissing", { length: PASSWORD_RESET_CODE_LENGTH });
}

/** Both password fields' problems at once, checked before anything is sent. */
export function validateNewPassword(password: string, confirm: string): ConfirmErrors {
  return {
    password: passwordProblem(password),
    confirm: password === confirm ? undefined : i18n.t("auth.password.mismatch"),
  };
}

/** Where a failed code check's sentence goes. Never the server's own message. */
export function verifyErrorsFor(error: unknown): CodeErrors {
  if (isNetworkError(error)) return { form: errorText(error, "auth.resetPassword.verifyFailed") };
  switch (getErrorCode(error)) {
    case "RESET_CODE_INVALID":
      return { code: i18n.t("auth.resetPassword.codeInvalid") };
    case "RATE_LIMITED":
      return { form: i18n.t("errors.tooManyAttempts", { minutes: RESET_WINDOW_MINUTES }) };
    default:
      return { form: i18n.t("auth.resetPassword.verifyFailed") };
  }
}

/** Where a failed confirm's sentence goes. Never the server's own message. */
export function confirmErrorsFor(error: unknown, password: string): ConfirmErrors {
  if (isNetworkError(error)) return { form: errorText(error, "auth.resetPassword.resetFailed") };
  switch (getErrorCode(error)) {
    case "RESET_CODE_INVALID":
      return { code: i18n.t("auth.resetPassword.codeInvalid") };
    case "WEAK_PASSWORD":
      return { password: passwordProblem(password) ?? passwordTooLong() };
    case "RATE_LIMITED":
      return { form: i18n.t("errors.tooManyAttempts", { minutes: RESET_WINDOW_MINUTES }) };
    default:
      return { form: i18n.t("auth.resetPassword.resetFailed") };
  }
}

/** What a failed "Gửi mã" / "Gửi lại mã" says. */
export function requestErrorMessage(error: unknown): string {
  if (isNetworkError(error)) return errorText(error, "auth.resetPassword.sendFailed");
  return getErrorCode(error) === "RATE_LIMITED"
    ? i18n.t("auth.resetPassword.sendLimited", { minutes: RESET_WINDOW_MINUTES })
    : i18n.t("auth.resetPassword.sendFailed");
}
