import { Pressable, Text, View } from "react-native";

import { ChevronRightIcon } from "@/components/ui/Icon";
import { withAlpha } from "@/lib/color";
import { createStyles, radii, spacing, typography, useColors } from "@/lib/theme";
import { CandidateAvatar } from "@/features/accounts/components/LoginCandidateViews";
import { LoginCandidate } from "@/features/accounts/login-candidates";

const AVATAR_SIZE = 28;
const MAX_AVATARS = 3;
// Each avatar tucks under the previous one by this much (as AvatarGroup).
const OVERLAP = 10;
const RING_WIDTH = 2;

const COPY = {
  title: "Tài khoản đã lưu",
  count: (n: number) => `${n} tài khoản`,
} as const;

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
  const colors = useColors();
  const styles = useStyles();
  const count = COPY.count(candidates.length);

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: withAlpha(colors.overlayBase, 0.08) }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${COPY.title}, ${count}`}
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
        <Text style={styles.title} numberOfLines={1}>{COPY.title}</Text>
        <Text style={styles.count} numberOfLines={1}>{count}</Text>
      </View>
      <ChevronRightIcon size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    overflow: "hidden",
  },
  pressed: { opacity: 0.85 },
  faces: { flexDirection: "row" },
  // The ring in the page colour is what separates two overlapping circles.
  ring: { borderRadius: 999, borderWidth: RING_WIDTH, borderColor: colors.surface },
  overlapped: { marginLeft: -OVERLAP },
  text: { flex: 1, gap: 2 },
  title: { ...typography.body, fontWeight: "600", color: colors.textPrimary },
  count: { ...typography.caption, color: colors.textSecondary },
}));
