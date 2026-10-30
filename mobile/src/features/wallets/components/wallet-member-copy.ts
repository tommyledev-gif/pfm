import { ErrorCodeKeys, errorText } from "@/lib/api-envelope";
import { i18n, TranslationKey } from "@/lib/i18n";
import { WalletAccess, WalletMember } from "@/features/wallets/types";

// Words for shared wallets (specs/shared-wallets US-06), one place so the
// sheet, the invitation cards and the cards say the same thing. Glossary:
// "ví chung", "chủ ví", "ghi chép", "chỉ xem", "lời mời".
// Keys, or text read at call time: never a sentence fixed at import, which
// would stay in the language the app started in.

/** Each role's name, as a key for t(). */
export const ROLE_LABEL_KEY: Record<WalletAccess, TranslationKey> = {
  owner: "sharedWallets.role.owner",
  editor: "sharedWallets.role.editor",
  viewer: "sharedWallets.role.viewer",
};

/** Each role's name in the current language, read when indexed. */
export const ROLE_LABEL: Record<WalletAccess, string> = {
  get owner() {
    return i18n.t(ROLE_LABEL_KEY.owner);
  },
  get editor() {
    return i18n.t(ROLE_LABEL_KEY.editor);
  },
  get viewer() {
    return i18n.t(ROLE_LABEL_KEY.viewer);
  },
};

export const ROLE_OPTIONS = [
  { labelKey: ROLE_LABEL_KEY.editor, value: "editor" as const },
  { labelKey: ROLE_LABEL_KEY.viewer, value: "viewer" as const },
];

/** The line under a member's name: role, and whether they have answered yet. */
export function memberStatusLine(member: WalletMember): string {
  const role = i18n.t(ROLE_LABEL_KEY[member.role]);
  if (member.status !== "pending") return role;
  // Invited by email: the account comes first, the answer after.
  return member.account_pending
    ? i18n.t("sharedWallets.member.statusAccountPending", { role })
    : i18n.t("sharedWallets.member.statusPending", { role });
}

/** Whether what the owner typed is an email (an invite can create its account) rather than a tên đăng nhập. */
export function isEmailIdentifier(text: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim());
}

/** An email with no account: inviting it emails a link to create one (the lookup row). */
export const NEW_ACCOUNT_INVITE_KEY: TranslationKey = "sharedWallets.invitee.newAccount";

/** Only the owner in the wallet, nobody invited either: under the owner's row. */
export const NO_OTHER_MEMBERS_KEY: TranslationKey = "sharedWallets.members.noOthers";

/** No account has what was typed: the invite's error and the field's lookup say the same. */
export const NO_ACCOUNT_KEY: TranslationKey = "sharedWallets.invite.error.noAccount";

// Every invite failure the server names gets its own sentence (pfm-ux-copy:
// never the server's raw message).
const INVITE_ERROR_KEYS: ErrorCodeKeys = {
  WALLET_MEMBER_USER_NOT_FOUND: NO_ACCOUNT_KEY,
  WALLET_MEMBER_EXISTS: "sharedWallets.invite.error.memberExists",
  WALLET_MEMBER_LIMIT: "sharedWallets.invite.error.limit",
  INVALID_INPUT: "sharedWallets.invite.error.self",
};

export function inviteErrorMessage(error: unknown): string {
  return errorText(error, "sharedWallets.invite.error.failed", INVITE_ERROR_KEYS);
}

/** BR-02: live memberships (pending + active) a wallet may hold, owner excluded. */
export const WALLET_MEMBER_LIMIT = 10;

/** What each role lets a member do — under the role options of the invite form. */
export const ROLE_DESCRIPTION_KEY: Record<"editor" | "viewer", TranslationKey> = {
  editor: "sharedWallets.role.editorHint",
  viewer: "sharedWallets.role.viewerHint",
};

/** "3 người · 1 chờ trả lời" — the owner counts as one of the people. */
export function memberCountLine(members: WalletMember[]): string {
  const pending = members.filter((m) => m.status === "pending").length;
  const people = i18n.t("sharedWallets.member.count", { count: members.length - pending });
  return pending > 0 ? i18n.t("sharedWallets.member.countWithPending", { people, pending }) : people;
}
