import { getErrorCode, getErrorMessage } from "@/lib/axios";
import { WalletAccess, WalletMember } from "@/features/wallets/types";

// Words for shared wallets (specs/shared-wallets US-06), one place so the
// sheet, the invitation cards and the cards say the same thing. Glossary:
// "ví chung", "chủ ví", "ghi chép", "chỉ xem", "lời mời".

export const ROLE_LABEL: Record<WalletAccess, string> = {
  owner: "Chủ ví",
  editor: "Ghi chép",
  viewer: "Chỉ xem",
};

export const ROLE_OPTIONS = [
  { label: ROLE_LABEL.editor, value: "editor" as const },
  { label: ROLE_LABEL.viewer, value: "viewer" as const },
];

/** The line under a member's name: role, and whether they have answered yet. */
export function memberStatusLine(member: WalletMember): string {
  const role = ROLE_LABEL[member.role];
  return member.status === "pending" ? `${role} · Chờ trả lời` : role;
}

// Every invite failure the server names gets its own sentence (pfm-ux-copy:
// never the server's raw message).
const INVITE_ERRORS: Record<string, string> = {
  WALLET_MEMBER_USER_NOT_FOUND: "Không có tài khoản nào với email hoặc tên đăng nhập này.",
  WALLET_MEMBER_EXISTS: "Người này đã ở trong ví hoặc chưa trả lời lời mời.",
  WALLET_MEMBER_LIMIT: "Ví đã đủ 10 người.",
  INVALID_INPUT: "Đây là tài khoản của bạn.",
};

export function inviteErrorMessage(error: unknown): string {
  const code = getErrorCode(error);
  if (code && INVITE_ERRORS[code]) return INVITE_ERRORS[code];
  return getErrorMessage(error, "Chưa gửi được lời mời. Thử lại.");
}

/** BR-02: live memberships (pending + active) a wallet may hold, owner excluded. */
export const WALLET_MEMBER_LIMIT = 10;

/** What each role lets a member do — under the role options of the invite form. */
export const ROLE_DESCRIPTION: Record<"editor" | "viewer", string> = {
  editor: "Thêm được giao dịch. Chỉ sửa được giao dịch mình ghi.",
  viewer: "Xem số dư và giao dịch, không thêm được.",
};

/** "3 người · 1 chờ trả lời" — the owner counts as one of the people. */
export function memberCountLine(members: WalletMember[]): string {
  const pending = members.filter((m) => m.status === "pending").length;
  const people = `${members.length - pending} người`;
  return pending > 0 ? `${people} · ${pending} chờ trả lời` : people;
}
