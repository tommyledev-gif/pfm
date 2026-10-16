import { PasskeyFailure } from "@/features/security/passkeys/native-passkey";

// What the phone's own failures mean to the User, per ceremony. Cancelled is
// not here: closing the sheet needs no message.
const SHARED: Partial<Record<PasskeyFailure, string>> = {
  "no-provider": "Máy chưa lưu được passkey. Đăng nhập tài khoản Google trên máy rồi thử lại.",
  timeout: "Máy không phản hồi khi mở passkey. Thử lại.",
};

const ADD: Partial<Record<PasskeyFailure, string>> = {
  ...SHARED,
  exists: "Máy này đã có passkey cho tài khoản này.",
  failed: "Chưa thêm được passkey. Thử lại.",
};

const SIGN_IN: Partial<Record<PasskeyFailure, string>> = {
  ...SHARED,
  "no-credential": "Máy này chưa có passkey. Đăng nhập bằng mật khẩu, rồi thêm passkey trong Bảo mật.",
  failed: "Không xác minh được passkey. Thử lại.",
};

/** The message for a failed add (Bảo mật) or sign-in; null when nothing should be said. */
export function passkeyFailureMessage(kind: PasskeyFailure, ceremony: "add" | "sign-in"): string | null {
  if (kind === "cancelled") return null;
  const messages = ceremony === "add" ? ADD : SIGN_IN;
  return messages[kind] ?? messages.failed ?? null;
}
