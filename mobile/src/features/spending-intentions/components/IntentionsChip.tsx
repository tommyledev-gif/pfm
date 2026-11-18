import { Pressable, Text } from "react-native";
import { useTranslation } from "react-i18next";

import { useSpendingIntentionsQuery } from "@/features/spending-intentions/api/use-spending-intentions-query";
import { radii, spacing, typography, createStyles } from "@/lib/theme";
import { useIntentionSheetsStore } from "@/stores/intention-sheets-store";

const DISABLED_OPACITY = 0.5;

/**
 * The first chip of the analysis input: opens the list of planned spending,
 * with how many are kept. The same tonal pill as the starter questions beside
 * it, so it reads as one of them — but it opens a sheet, not an answer.
 */
export function IntentionsChip({ disabled }: { disabled?: boolean }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const openList = useIntentionSheetsStore((s) => s.openList);
  const list = useSpendingIntentionsQuery();
  const count = list.data?.items.length ?? 0;
  return (
    <Pressable
      testID="chip-intentions"
      disabled={disabled}
      onPress={openList}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={styles.label} numberOfLines={1}>
        {count > 0 ? t("intentions.chipCount", { count }) : t("intentions.chip")}
      </Text>
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
  },
  pressed: { backgroundColor: colors.surface },
  label: { ...typography.caption, color: colors.textSecondary },
  disabled: { opacity: DISABLED_OPACITY },
}));
