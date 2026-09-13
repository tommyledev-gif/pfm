import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PRESET_OPTIONS, PresetKey } from "@/features/budget-wizard/types";
import { colors, radii, spacing, typography } from "@/lib/theme";

interface WizardStepProfileProps {
  selected: PresetKey | null;
  onSelect: (key: PresetKey) => void;
}

/**
 * Screen 2 — one question.
 *
 * v1 asked the user to set a spending level for each of up to 20 categories:
 * as many as 120 decisions, every one of which presumes they already know their
 * own spending. The people who install a budgeting app are precisely the ones
 * who do not, so those answers were guesses being treated as data.
 *
 * This asks about living situation instead — something the user knows for
 * certain, answers in one tap, and which correlates well enough with spending
 * shape to be a defensible starting point. The honest trade is stated plainly on
 * the next screen: it is an estimate, and it will be corrected.
 */
export function WizardStepProfile({ selected, onSelect }: WizardStepProfileProps) {
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.head}>
        <Text style={styles.title}>Bạn đang sống kiểu nào?</Text>
        <Text style={styles.subtitle}>Tôi sẽ dựng ngân sách khởi điểm từ đây.</Text>
      </View>

      {PRESET_OPTIONS.map((opt) => {
        const active = opt.key === selected;
        return (
          <Pressable
            key={opt.key}
            testID={`btn-wizard-preset-${opt.key}`}
            onPress={() => onSelect(opt.key)}
            style={[styles.option, active && styles.optionActive]}
          >
            <Text style={styles.optionIcon}>{opt.icon}</Text>
            <Text style={styles.optionLabel}>{opt.label}</Text>
            {active ? <Text style={styles.tick}>✓</Text> : null}
          </Pressable>
        );
      })}

      {/* The free-text entry point ("kể tôi nghe cách bạn tiêu tiền") belongs to
          Phase 4 and is NOT rendered here, disabled or otherwise. A visible
          control that does nothing costs more trust than an absent one — the
          user cannot tell a deliberate gap from a broken button. */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.sm },
  head: { gap: spacing.xs, marginBottom: spacing.sm },
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.listCard,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  optionActive: { borderColor: colors.green, backgroundColor: "rgba(133,255,51,0.06)" },
  optionIcon: { fontSize: 20 },
  optionLabel: { ...typography.body, color: colors.textPrimary, flex: 1 },
  tick: { ...typography.body, color: colors.green },
});
