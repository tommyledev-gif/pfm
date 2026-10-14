import { Pressable, Text, View } from "react-native";
import { XIcon } from "phosphor-react-native/src/icons/X";

import { Avatar } from "@/components/ui/Avatar";
import { colorForCategory } from "@/lib/category-color";
import { withAlpha } from "@/lib/color";
import { createStyles, radii, spacing, typography, useColors } from "@/lib/theme";
import { useAccessRequestStatusQuery } from "@/features/auth/api/use-access-request-status-query";
import { maskEmail, REMOVE_ACCOUNT_COPY } from "@/features/accounts/account-copy";
import { isAccountExpired } from "@/features/accounts/account-registry-store";
import { ACCOUNT_STATUS_COPY } from "@/features/accounts/components/AccountRow";
import { candidateEmail, candidateName, LoginCandidate } from "@/features/accounts/login-candidates";

const ROW_AVATAR_SIZE = 40;
const CARD_AVATAR_SIZE = 48;

export const CANDIDATE_STATUS_COPY = {
  awaiting: "Chờ duyệt",
  test: "Test",
} as const;

/**
 * Whether a sent request still waits for an admin (spec: the sign-in stays
 * off until then). Only a "requested" candidate asks the server; while the
 * first answer is on its way it counts as waiting.
 */
export function useCandidateAwaiting(candidate: LoginCandidate): boolean {
  const status = useAccessRequestStatusQuery(candidateEmail(candidate), candidate.kind === "requested");
  return candidate.kind === "requested" && status.data !== false;
}

/** A person's picture or initial; a sent request has no account yet, so the app's logo. */
export function CandidateAvatar({ candidate, size }: { candidate: LoginCandidate; size: number }) {
  const name = candidateName(candidate);
  if (candidate.kind === "requested") return <Avatar name={name} size={size} fallback="logo" />;
  const account = candidate.kind === "saved" ? candidate.account : null;
  return (
    <Avatar
      name={name}
      iconUrl={account?.avatarUrl}
      color={colorForCategory(account?.userId ?? candidateEmail(candidate))}
      size={size}
      fallback="initial"
    />
  );
}

// The login screen shows a remembered person to whoever holds the phone, so
// the email is half hidden (account-copy.ts); a test account is no one's.
function secondaryLine(candidate: LoginCandidate): string {
  if (candidate.kind === "test") return candidate.email;
  const email = maskEmail(candidateEmail(candidate));
  const username = candidate.kind === "saved" ? candidate.account.username : null;
  return username ? `@${username} · ${email}` : email;
}

function statusLabel(candidate: LoginCandidate, awaiting: boolean): string | null {
  if (candidate.kind === "saved") return isAccountExpired(candidate.account) ? ACCOUNT_STATUS_COPY.expired : null;
  if (candidate.kind === "test") return CANDIDATE_STATUS_COPY.test;
  return awaiting ? CANDIDATE_STATUS_COPY.awaiting : null;
}

function Identity({ candidate, large = false }: { candidate: LoginCandidate; large?: boolean }) {
  const styles = useStyles();
  const awaiting = useCandidateAwaiting(candidate);
  const status = statusLabel(candidate, awaiting);
  return (
    <>
      <View style={styles.info}>
        <Text style={large ? styles.nameLarge : styles.name} numberOfLines={1}>
          {candidateName(candidate)}
        </Text>
        <Text style={large ? styles.emailLarge : styles.email} numberOfLines={1}>
          {secondaryLine(candidate)}
        </Text>
      </View>
      {status ? (
        <View style={[styles.pill, candidate.kind === "test" ? styles.pillTest : styles.pillWarn]}>
          <Text style={[styles.pillText, candidate.kind === "test" ? styles.pillTestText : styles.pillWarnText]}>{status}</Text>
        </View>
      ) : null}
    </>
  );
}

interface CandidateRowProps {
  candidate: LoginCandidate;
  onPress: () => void;
  /** Omitted for a test account: the debug list is not the device's to edit. */
  onRemove?: () => void;
}

/** One person in the saved-accounts list; the × removes them from the device. */
export function CandidateRow({ candidate, onPress, onRemove }: CandidateRowProps) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPress}
        android_ripple={{ color: withAlpha(colors.overlayBase, 0.08) }}
        style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
        accessibilityRole="button"
        testID={`row-login-candidate-${candidate.key}`}
      >
        <CandidateAvatar candidate={candidate} size={ROW_AVATAR_SIZE} />
        <Identity candidate={candidate} />
      </Pressable>
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          style={styles.remove}
          accessibilityRole="button"
          accessibilityLabel={REMOVE_ACCOUNT_COPY.action(candidateName(candidate))}
        >
          <XIcon size={18} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** The chosen person, above the way in. */
export function CandidateCard({ candidate }: { candidate: LoginCandidate }) {
  const styles = useStyles();
  return (
    <View style={styles.card} testID="card-login-candidate">
      <CandidateAvatar candidate={candidate} size={CARD_AVATAR_SIZE} />
      <Identity candidate={candidate} large />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    overflow: "hidden",
  },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  pressed: { opacity: 0.85 },
  remove: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  card: {
    width: "100%",
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 16,
  },
  info: { flex: 1, gap: 2 },
  name: { ...typography.body, fontWeight: "600", color: colors.textPrimary },
  email: { ...typography.caption, color: colors.textSecondary },
  nameLarge: { fontSize: 17, fontWeight: "600", color: colors.textPrimary },
  emailLarge: { fontSize: 14, color: colors.textSecondary },
  pill: { paddingVertical: 4, paddingHorizontal: spacing.sm, borderRadius: 999 },
  pillText: { fontSize: 12, fontWeight: "500" },
  pillWarn: { backgroundColor: withAlpha(colors.mustard, 0.12) },
  pillWarnText: { color: colors.mustard },
  pillTest: { backgroundColor: withAlpha(colors.lavender, 0.12) },
  pillTestText: { color: colors.lavender },
}));
