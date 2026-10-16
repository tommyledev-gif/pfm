import { getErrorCode, getErrorMessage } from "@/lib/axios";
import { isNetworkError } from "@/lib/api-envelope";

const FAILED = "Chưa đăng nhập được. Thử lại.";

// The server's messages are English fragments meant for logs ("invalid email
// or password"), so login failures are worded here, by error code.
const ERROR_COPY: Record<string, string> = {
  // Never says which of the two was wrong.
  INVALID_CREDENTIALS: "Tài khoản hoặc mật khẩu không đúng.",
  // LoginRateLimiter / LoginAccountRateLimiter: a 15-minute window.
  RATE_LIMITED: "Đăng nhập sai quá nhiều lần. Thử lại sau 15 phút.",
  ACCOUNT_NOT_ACTIVATED: "Tài khoản chưa kích hoạt. Mở email mời để kích hoạt.",
  ACCOUNT_AWAITING_APPROVAL: "Yêu cầu tạo tài khoản đang chờ admin duyệt.",
  ACCOUNT_DISABLED: "Tài khoản đã bị khóa. Liên hệ admin.",
  // Passkey sign-in (PasskeySignInButton).
  PASSKEY_FAILED: "Không xác minh được passkey. Thử lại.",
  PASSKEYS_UNAVAILABLE: "Chưa dùng được passkey. Đăng nhập bằng mật khẩu.",
};

/** What a failed sign-in says — password or passkey, same account-status answers. */
export function loginErrorMessage(error: unknown): string {
  if (isNetworkError(error)) return getErrorMessage(error, FAILED);
  return ERROR_COPY[getErrorCode(error) ?? ""] ?? FAILED;
}
