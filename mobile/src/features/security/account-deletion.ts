// Mirrors backend common.AccountDeletionOperatorEmail. Only decides whether
// the Security screen shows the account deletion tool — the server makes the
// real check (403 for anyone else).
export const ACCOUNT_DELETION_OPERATOR_EMAIL = "owner@example.com";

export function isAccountDeletionOperator(email: string | null): boolean {
  return email?.trim().toLowerCase() === ACCOUNT_DELETION_OPERATOR_EMAIL;
}
