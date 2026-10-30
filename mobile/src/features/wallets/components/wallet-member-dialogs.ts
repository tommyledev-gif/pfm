import { i18n } from "@/lib/i18n";
import { WalletMember } from "@/features/wallets/types";

// The members sheet's confirm dialog, one set of words per action. Split out
// of WalletMembersSheet to keep it under the 300-line cap. Read at call time,
// so the dialog follows the app language.

export type PendingMemberAction =
  | { kind: "role"; member: WalletMember }
  | { kind: "remove"; member: WalletMember }
  | { kind: "leave"; member: WalletMember };

// A role change goes editor → viewer, anything else → editor.
function toViewer(member: WalletMember) {
  return member.role === "editor";
}

export function dialogTitle(action: PendingMemberAction | null, walletName: string): string {
  if (!action) return "";
  const name = action.member.name;
  if (action.kind === "role") {
    return toViewer(action.member)
      ? i18n.t("sharedWallets.memberDialog.toViewer.title", { name })
      : i18n.t("sharedWallets.memberDialog.toEditor.title", { name });
  }
  if (action.kind === "leave") return i18n.t("sharedWallets.memberDialog.leave.title", { wallet: walletName });
  return action.member.status === "pending"
    ? i18n.t("sharedWallets.memberDialog.revoke.title")
    : i18n.t("sharedWallets.memberDialog.remove.title", { name });
}

export function dialogMessage(action: PendingMemberAction | null): string {
  if (!action) return "";
  if (action.kind === "role") {
    return toViewer(action.member)
      ? i18n.t("sharedWallets.memberDialog.toViewer.body")
      : i18n.t("sharedWallets.memberDialog.toEditor.body");
  }
  if (action.kind === "leave") return i18n.t("sharedWallets.memberDialog.leave.body");
  const name = action.member.name;
  return action.member.status === "pending"
    ? i18n.t("sharedWallets.memberDialog.revoke.body", { name })
    : i18n.t("sharedWallets.memberDialog.remove.body", { name });
}

export function dialogConfirm(action: PendingMemberAction | null): string {
  if (!action) return "";
  if (action.kind === "role") {
    return toViewer(action.member) ? i18n.t("sharedWallets.action.toViewer") : i18n.t("sharedWallets.action.toEditor");
  }
  if (action.kind === "leave") return i18n.t("sharedWallets.action.leave");
  return action.member.status === "pending"
    ? i18n.t("sharedWallets.action.revokeInvitation")
    : i18n.t("sharedWallets.action.removeMember");
}
