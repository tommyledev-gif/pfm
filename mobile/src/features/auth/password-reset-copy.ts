import { getErrorCode, getErrorMessage, isNetworkError } from "@/lib/api-envelope";
import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH, PASSWORD_RESET_CODE_LENGTH } from "@/lib/constants";
import { passwordLengthProblem } from "@/lib/password-rules";

// Forgot password (specs/forgot-password §UI copy).
export const RESET_COPY = {
  title: "Đặt lại mật khẩu",
  requestSub: "Mã đặt lại gửi tới email của tài khoản.",
  identifierLabel: "Email hoặc tên đăng nhập",
  identifierPlaceholder: "ten@email.com",
  sendCode: "Gửi mã",
  codeLabel: "Mã đặt lại",
  codePlaceholder: "6 số trong email",
  passwordLabel: "Mật khẩu mới",
  passwordPlaceholder: `Ít nhất ${MIN_PASSWORD_LENGTH} ký tự`,
  confirmLabel: "Nhập lại mật khẩu mới",
  showPassword: "Hiện mật khẩu",
  hidePassword: "Ẩn mật khẩu",
  submit: "Đặt lại mật khẩu",
  resend: "Gửi lại mã",
  back: "Quay lại",
  done: "Đã đặt lại mật khẩu",
} as const;

/** Step 2's line under the title. Never says whether the account exists. */
export function confirmSub(identifier: string): string {
  return `Nếu ${identifier} có tài khoản, mã ${PASSWORD_RESET_CODE_LENGTH} số đã gửi tới email của tài khoản đó. Mã dùng được trong 15 phút.`;
}

export function resendIn(seconds: number): string {
  return `Gửi lại mã sau ${seconds} giây`;
}

const FIELD_COPY = {
  identifierMissing: "Nhập email hoặc tên đăng nhập.",
  codeMissing: `Nhập mã ${PASSWORD_RESET_CODE_LENGTH} số.`,
  codeInvalid: "Mã không đúng hoặc đã hết hạn.",
  passwordShort: `Mật khẩu cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`,
  passwordLong: `Mật khẩu tối đa ${MAX_PASSWORD_BYTES} ký tự không dấu.`,
  mismatch: "Hai mật khẩu chưa khớp.",
} as const;

const FORM_COPY = {
  sendFailed: "Chưa gửi được mã. Thử lại.",
  sendLimited: "Đã gửi quá nhiều mã. Thử lại sau 15 phút.",
  resetFailed: "Chưa đặt lại được mật khẩu. Thử lại.",
  resetLimited: "Thử quá nhiều lần. Thử lại sau 15 phút.",
} as const;

const CODE_PATTERN = new RegExp(`^[0-9]{${PASSWORD_RESET_CODE_LENGTH}}$`);

export function identifierProblem(identifier: string): string | undefined {
  return identifier ? undefined : FIELD_COPY.identifierMissing;
}

export interface ConfirmErrors {
  code?: string;
  password?: string;
  confirm?: string;
  form?: string;
}

function passwordProblem(password: string): string | undefined {
  const problem = passwordLengthProblem(password);
  if (problem === "short") return FIELD_COPY.passwordShort;
  if (problem === "long") return FIELD_COPY.passwordLong;
  return undefined;
}

/** Every field's problem at once, checked before anything is sent. */
export function validateConfirm(code: string, password: string, confirm: string): ConfirmErrors {
  return {
    code: CODE_PATTERN.test(code) ? undefined : FIELD_COPY.codeMissing,
    password: passwordProblem(password),
    confirm: password === confirm ? undefined : FIELD_COPY.mismatch,
  };
}

/** Where a failed confirm's sentence goes. Never the server's own message. */
export function confirmErrorsFor(error: unknown, password: string): ConfirmErrors {
  if (isNetworkError(error)) return { form: getErrorMessage(error, FORM_COPY.resetFailed) };
  switch (getErrorCode(error)) {
    case "RESET_CODE_INVALID":
      return { code: FIELD_COPY.codeInvalid };
    case "WEAK_PASSWORD":
      return { password: passwordProblem(password) ?? FIELD_COPY.passwordLong };
    case "RATE_LIMITED":
      return { form: FORM_COPY.resetLimited };
    default:
      return { form: FORM_COPY.resetFailed };
  }
}

/** What a failed "Gửi mã" / "Gửi lại mã" says. */
export function requestErrorMessage(error: unknown): string {
  if (isNetworkError(error)) return getErrorMessage(error, FORM_COPY.sendFailed);
  return getErrorCode(error) === "RATE_LIMITED" ? FORM_COPY.sendLimited : FORM_COPY.sendFailed;
}
