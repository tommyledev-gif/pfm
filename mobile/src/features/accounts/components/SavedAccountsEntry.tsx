import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { PressableScale } from "@/components/motion/PressableScale";
import { ChevronRightIcon } from "@/components/ui/Icon";
import { withAlpha } from "@/lib/color";
import { createStyles, radii, spacing, typography, useColors } from "@/lib/theme";
import { CandidateAvatar } from "@/features/accounts/components/LoginCandidateViews";
import { LoginCandidate } from "@/features/accounts/login-candidates";

const AVATAR_SIZE = 36;
const MAX_AVATARS = 3;
// Each avatar tucks under the previous one by this much (as AvatarGroup).
const OVERLAP = 12;
const RING_WIDTH = 2;

interface SavedAccountsEntryProps {
  candidates: LoginCandidate[];
  onPress: () => void;
}

/**
 * The login form's one-line way to the saved-accounts view: who is
 * remembered on this device (faces, then a count), one tap to open them.
 * Rendered only when there is at least one.
 */
export function SavedAccountsEntry({ candidates, onPress }: SavedAccountsEntryProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const count = candidates.length;

  return (
    <PressableScale
      onPress={onPress}
      android_ripple={{ color: withAlpha(colors.overlayBase, 0.08) }}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={t("accounts.savedEntry.a11y", { count })}
      testID="btn-login-saved-accounts"
    >
      <View style={styles.faces}>
        {candidates.slice(0, MAX_AVATARS).map((candidate, index) => (
          <View key={candidate.key} style={[styles.ring, index > 0 && styles.overlapped]}>
            <CandidateAvatar candidate={candidate} size={AVATAR_SIZE} />
          </View>
        ))}
      </View>
      <View style={styles.text}>
        {/* Names what the tap does: it sits under "hoặc" as one of the ways in. */}
        <Text style={styles.title} numberOfLines={1}>{t("accounts.savedEntry.title")}</Text>
        <Text style={styles.count} numberOfLines={1}>{t("accounts.savedEntry.count", { count })}</Text>
      </View>
      <ChevronRightIcon size={20} color={colors.textSecondary} />
    </PressableScale>
  );
}

const useStyles = createStyles((colors) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    overflow: "hidden",
  },
  faces: { flexDirection: "row" },
  // The ring in the page colour is what separates two overlapping circles.
  ring: { borderRadius: 999, borderWidth: RING_WIDTH, borderColor: colors.surface },
  overlapped: { marginLeft: -OVERLAP },
  text: { flex: 1, gap: 2 },
  title: { ...typography.body, fontWeight: "700", color: colors.textPrimary },
  count: { ...typography.caption, color: colors.textSecondary },
}));
