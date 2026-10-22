import { WalletMember } from "@/features/wallets/types";
import { ROLE_LABEL } from "@/features/wallets/components/wallet-member-copy";

// The members sheet's confirm dialog, one set of words per action. Split out
// of WalletMembersSheet to keep it under the 300-line cap.

export type PendingMemberAction =
  | { kind: "role"; member: WalletMember }
  | { kind: "remove"; member: WalletMember }
  | { kind: "leave"; member: WalletMember };

function nextRole(member: WalletMember) {
  return member.role === "editor" ? ROLE_LABEL.viewer : ROLE_LABEL.editor;
}

export function dialogTitle(action: PendingMemberAction | null, walletName: string): string {
  if (!action) return "";
  if (action.kind === "role") return `Đổi ${action.member.name} sang ${nextRole(action.member)}?`;
  if (action.kind === "leave") return `Rời ví ${walletName}?`;
  return action.member.status === "pending" ? "Thu hồi lời mời?" : `Xóa ${action.member.name} khỏi ví?`;
}

export function dialogMessage(action: PendingMemberAction | null): string {
  if (!action) return "";
  if (action.kind === "role") {
    return action.member.role === "editor"
      ? "Người này vẫn xem được ví nhưng không thêm được giao dịch."
      : "Người này thêm được giao dịch vào ví.";
  }
  if (action.kind === "leave") return "Ví sẽ không còn trong danh sách của bạn. Giao dịch bạn đã ghi vẫn ở lại trong ví.";
  return action.member.status === "pending"
    ? `${action.member.name} sẽ không vào được ví này.`
    : `Giao dịch ${action.member.name} đã ghi vẫn ở lại trong ví.`;
}

export function dialogConfirm(action: PendingMemberAction | null): string {
  if (!action) return "";
  if (action.kind === "role") return `Đổi sang ${nextRole(action.member)}`;
  if (action.kind === "leave") return "Rời ví";
  return action.member.status === "pending" ? "Thu hồi lời mời" : "Xóa khỏi ví";
}
