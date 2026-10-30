import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { ChevronDownIcon } from "@/components/ui/Icon";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { WalletAccess } from "@/features/wallets/types";
import { ROLE_LABEL_KEY } from "@/features/wallets/components/wallet-member-copy";

interface RolePillProps {
  role: WalletAccess;
  /** An invitation not yet answered: shown instead of the role. */
  pending?: boolean;
  /** The owner changing a member's role: the pill becomes a button. */
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * A member's role as a small tinted pill — one colour per role, so a list of
 * people reads at a glance: the owner in the app green, "Ghi chép" in
 * periwinkle, "Chỉ xem" neutral, an unanswered invitation in amber. With
 * `onPress` it gets a chevron and opens the role change.
 */
export function RolePill({ role, pending = false, onPress, accessibilityLabel, testID }: RolePillProps) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const tone = pending
    ? colors.mustard
    : role === "owner"
      ? colors.green
      : role === "editor"
        ? colors.periwinkle
        : colors.textSecondary;
  const label = pending ? t("common.status.awaitingReply") : t(ROLE_LABEL_KEY[role]);
  const body = (
    <>
      <Text style={[styles.label, { color: tone }]} numberOfLines={1}>
        {label}
      </Text>
      {onPress ? <ChevronDownIcon size={12} color={tone} strokeWidth={2.6} /> : null}
    </>
  );
  // "Chỉ xem" is the neutral one: its text colour is an rgba token, so the
  // tint comes from the theme's overlay base instead.
  const tint = !pending && role === "viewer" ? colors.overlayBase : tone;
  const pillStyle = [styles.pill, { backgroundColor: withAlpha(tint, 0.1), borderColor: withAlpha(tint, 0.22) }];

  if (!onPress) {
    return (
      <View style={[pillStyle, styles.row]} testID={testID}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [pillStyle, styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {body}
    </Pressable>
  );
}

const useStyles = createStyles(() => ({
  pill: {
    alignSelf: "flex-start",
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  pressed: { opacity: 0.7 },
  label: { ...typography.tiny, fontWeight: "700" },
}));
