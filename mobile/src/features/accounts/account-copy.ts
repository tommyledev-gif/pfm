import { TranslationKey } from "@/lib/i18n";

// Removing a saved account reads the same wherever it is offered: the switch
// dialog's trash button and the login screen's per-row ×. The body says the
// account is not deleted: "gỡ" alone reads as deleting it on the server.
// Keys, passed to t() where shown; action and title take {{name}}.
export const REMOVE_ACCOUNT_COPY = {
  action: "accounts.remove.action",
  title: "accounts.remove.title",
  message: "accounts.remove.message",
  // Short enough for a half-width dialog button; the title names what goes.
  confirm: "accounts.remove.confirm",
  cancel: "common.action.keep",
} as const satisfies Record<string, TranslationKey>;

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
