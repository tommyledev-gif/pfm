import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PillButton } from "@/components/ui/PillButton";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { SPENDING_PREFERENCES, SpendingPreference, WizardSelection } from "@/features/budget-wizard/types";

const PREFERENCE_LABELS: Record<SpendingPreference, string> = {
  very_little: "Rất ít",
  little: "Ít",
  normal: "Bình thường",
  a_lot: "Nhiều",
  priority: "Ưu tiên",
  ai_decides: "Để AI quyết định",
};

interface WizardStepPreferencesProps {
  selections: WizardSelection[];
  onChangePreference: (categoryId: string, preference: SpendingPreference) => void;
  onNext: () => void;
  onBack: () => void;
}

export function WizardStepPreferences({ selections, onChangePreference, onNext, onBack }: WizardStepPreferencesProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mức độ chi tiêu</Text>
      <Text style={styles.subtitle}>Cho mỗi danh mục, chọn mức độ chi tiêu mong muốn.</Text>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {selections.map((s) => (
          <View key={s.categoryId} style={styles.row}>
            <Text style={styles.categoryName} numberOfLines={1}>
              {s.categoryName}
            </Text>
            <View style={styles.chipWrap}>
              {SPENDING_PREFERENCES.map((p) => (
                <Pressable
                  key={p}
                  testID="chip-wizard-preference"
                  onPress={() => onChangePreference(s.categoryId, p)}
                  style={[styles.chip, s.preference === p && styles.chipActive]}
                >
                  <Text style={[styles.chipLabel, s.preference === p && styles.chipLabelActive]}>
                    {PREFERENCE_LABELS[p]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.actions}>
        <PillButton label="Quay lại" variant="outline" onPress={onBack} style={styles.flexButton} />
        <PillButton label="Xem đề xuất" onPress={onNext} style={styles.flexButton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  scroll: { maxHeight: 340 },
  row: { gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder },
  categoryName: { ...typography.body, color: colors.textPrimary },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipLabel: { ...typography.tiny, color: colors.textSecondary },
  chipLabelActive: { color: colors.onGreen },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  flexButton: { flex: 1 },
});
