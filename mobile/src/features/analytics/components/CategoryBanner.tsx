import { Pressable, Text, View } from "react-native";
import { Trans, useTranslation } from "react-i18next";

import { ConsultCategoryRef } from "@/features/analytics/types";
import { spacing, typography, createStyles } from "@/lib/theme";

interface CategoryBannerProps {
  categories: ConsultCategoryRef[];
  onChange: () => void;
}

// Shown when a typed question named a Category the System matched with only
// medium confidence (spec.md S-AIQ-24): the figures are shown, but the User
// sees exactly which Categories they cover and can change them.
//
// Only ever under a low-confidence answer, and at its END as one quiet line
// with a text link — a reading the System is sure of needs no echo, the
// answer's own sentence already says what it covers.
export function CategoryBanner({ categories, onChange }: CategoryBannerProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <View style={styles.line}>
      <Text style={styles.text}>
        <Trans
          t={t}
          i18nKey="analytics.banner.countingFor"
          values={{ categories: categories.map((c) => c.name).join(", ") }}
          components={[<Text key="names" style={styles.names} />]}
        />
      </Text>
      <Pressable testID="btn-analytics-change-category" accessibilityRole="button" onPress={onChange} hitSlop={spacing.sm}>
        <Text style={styles.change}>{t("analytics.banner.change")}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  line: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, marginTop: spacing.md },
  text: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
  names: { color: colors.textPrimary },
  change: { ...typography.caption, color: colors.green },
}));
