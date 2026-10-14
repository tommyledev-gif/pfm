import { useMemo } from "react";

import { TEST_ACCOUNTS } from "@/lib/dev-login";
import { useDebugTestAccountsStore } from "@/stores/debug-test-accounts-store";
import { useAccessRequestStore } from "@/features/auth/access-request-store";
import { accountDisplayName, useAccountRegistryStore } from "@/features/accounts/account-registry-store";
import { SavedAccount } from "@/features/accounts/types";

/**
 * Someone the login screen's saved-accounts view can sign in:
 *  - saved: a User remembered on this device (specs/mobile-account-switch);
 *    `testPassword` fills the password in when it is also a test account;
 *  - requested: an access request sent from here, held until an admin approves;
 *  - test: a debug-console test account, password filled in.
 */
export type LoginCandidate =
  | { kind: "saved"; key: string; account: SavedAccount; testPassword?: string }
  | { kind: "requested"; key: string; email: string }
  | { kind: "test"; key: string; email: string; password: string };

const lower = (email: string) => email.trim().toLowerCase();

export function candidateEmail(candidate: LoginCandidate): string {
  return candidate.kind === "saved" ? candidate.account.email : candidate.email;
}

export function candidateName(candidate: LoginCandidate): string {
  return candidate.kind === "saved"
    ? accountDisplayName(candidate.account)
    : accountDisplayName({ email: candidate.email, fullName: null });
}

/**
 * Everyone the login screen offers, saved accounts first (most recently used
 * first), then sent requests, then the test accounts. One entry per email: a
 * saved account wins, since it may need no password at all.
 */
export function useLoginCandidates(): { candidates: LoginCandidate[]; isHydrated: boolean } {
  const isHydrated = useAccountRegistryStore((s) => s.isHydrated);
  const accounts = useAccountRegistryStore((s) => s.accounts);
  const requests = useAccessRequestStore((s) => s.requests);
  const testShown = useDebugTestAccountsStore((s) => s.shown);

  const candidates = useMemo(() => {
    const tests = testShown ? TEST_ACCOUNTS : [];
    const testPasswordFor = (email: string) => tests.find((t) => lower(t.email) === lower(email))?.password;
    const saved: LoginCandidate[] = [...accounts]
      .sort((a, b) => Date.parse(b.lastUsedAt) - Date.parse(a.lastUsedAt))
      .map((account) => ({ kind: "saved", key: account.userId, account, testPassword: testPasswordFor(account.email) }));
    const taken = new Set(accounts.map((a) => lower(a.email)));
    const requested: LoginCandidate[] = requests
      .filter((r) => !taken.has(lower(r.email)))
      .map((r) => ({ kind: "requested", key: `requested:${lower(r.email)}`, email: r.email }));
    requests.forEach((r) => taken.add(lower(r.email)));
    const test: LoginCandidate[] = tests
      .filter((t) => !taken.has(lower(t.email)))
      .map((t) => ({ kind: "test", key: `test:${lower(t.email)}`, email: t.email, password: t.password }));
    return [...saved, ...requested, ...test];
  }, [accounts, requests, testShown]);

  return { candidates, isHydrated };
}
