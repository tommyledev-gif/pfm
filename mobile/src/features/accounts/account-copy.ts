// Removing a saved account reads the same wherever it is offered: the switch
// dialog's trash button and the login screen's per-row ×. The body says the
// account is not deleted: "gỡ" alone reads as deleting it on the server.
export const REMOVE_ACCOUNT_COPY = {
  action: (name: string) => `Gỡ ${name} khỏi thiết bị`,
  title: (name: string) => `Gỡ ${name} khỏi thiết bị?`,
  message: "Tài khoản không bị xóa. Lần sau phải nhập lại email và mật khẩu.",
  // Short enough for a half-width dialog button; the title names what goes.
  confirm: "Gỡ",
  cancel: "Giữ lại",
} as const;

/**
 * The login screen shows a remembered account to whoever holds the phone, so
 * its email is half hidden: enough for the owner to recognise, not enough to
 * read off a locked device. "owner@example.com" → "t•••e@gmail.com".
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 2) return `${local.charAt(0)}•••${domain}`;
  return `${local.charAt(0)}•••${local.charAt(local.length - 1)}${domain}`;
}
