import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { PillButton } from "@/components/ui/PillButton";
import { createStyles, spacing, typography } from "@/lib/theme";
import { REMOVE_ACCOUNT_COPY } from "@/features/accounts/account-copy";
import { isAccountExpired } from "@/features/accounts/account-registry-store";
import { CandidateCard, useCandidateAwaiting } from "@/features/accounts/components/LoginCandidateViews";
import { candidateEmail, candidateName, LoginCandidate } from "@/features/accounts/login-candidates";
import { switchToAccount } from "@/features/accounts/switch-account";
import { LoginForm } from "@/features/auth/components/LoginForm";

const ACTION_HEIGHT = 56;
const ACTION_RADIUS = 16;

const COPY = {
  signIn: "common.action.signIn",
  awaiting: "accounts.candidate.awaitingHint",
  approved: "accounts.candidate.approvedHint",
} as const;

interface CandidateSignInProps {
  candidate: LoginCandidate;
  onDone: () => void;
  /** Removes them from the device; omitted for a test account. */
  onRemove?: () => void;
}

/**
 * The chosen person and one way in (specs/mobile-account-switch US-05):
 *  - saved, session still valid: one tap switches in (identity check first);
 *  - saved but "Cần đăng nhập lại", or a test account: the password, nothing else
 *    (filled in for a test account). A session the server refused — expired,
 *    signed out from another device, password changed — cannot be renewed,
 *    so no fingerprint shortcut there;
 *  - a sent request: the password too, held off until an admin approves.
 *
 * Remounted per person (the caller keys it), so `refused` never carries over.
 */
export function CandidateSignIn({ candidate, onDone, onRemove }: CandidateSignInProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const [switching, setSwitching] = useState(false);
  // switchToAccount can find the token refused even though it had not
  // expired by the clock; from then on this account needs its password.
  const [refused, setRefused] = useState(false);
  const awaiting = useCandidateAwaiting(candidate);
  const oneTap = candidate.kind === "saved" && !refused && !isAccountExpired(candidate.account);

  const continueAs = (userId: string) => {
    setSwitching(true);
    switchToAccount(userId)
      .then((outcome) => {
        if (outcome === "expired") setRefused(true);
      })
      .catch(() => {})
      .finally(() => setSwitching(false));
  };

  const prefilledPassword =
    candidate.kind === "test" ? candidate.password : candidate.kind === "saved" ? candidate.testPassword : undefined;
  const hint = candidate.kind === "requested" ? (awaiting ? COPY.awaiting : COPY.approved) : null;

  return (
    <View style={styles.column}>
      <CandidateCard candidate={candidate} />
      {hint ? <Text style={styles.hint}>{t(hint)}</Text> : null}

      <View style={styles.action}>
        {candidate.kind === "saved" && oneTap ? (
          <PillButton
            label={t(COPY.signIn)}
            loading={switching}
            onPress={() => continueAs(candidate.account.userId)}
            style={styles.signIn}
            textStyle={styles.signInLabel}
            testID="btn-login-continue-as"
          />
        ) : (
          <LoginForm
            initialEmail={candidateEmail(candidate)}
            initialPassword={prefilledPassword}
            disabled={awaiting}
            hideEmail
            onDone={onDone}
          />
        )}
      </View>

      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button" testID="btn-login-remove-candidate">
          <Text style={styles.remove}>{t(REMOVE_ACCOUNT_COPY.action, { name: candidateName(candidate) })}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  column: { width: "100%", alignItems: "center", gap: spacing.md },
  hint: { ...typography.caption, color: colors.textSecondary, alignSelf: "stretch" },
  action: { width: "100%", marginTop: spacing.sm },
  signIn: { height: ACTION_HEIGHT, borderRadius: ACTION_RADIUS },
  signInLabel: { fontSize: 16 },
  remove: { ...typography.label, color: colors.textSecondary, marginTop: spacing.sm },
}));
