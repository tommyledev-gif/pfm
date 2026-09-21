import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { CheckIcon } from "@/components/ui/Icon";
import { WizardAmbientGlow } from "@/features/budget-wizard/components/WizardAmbientGlow";
import { PRESET_OPTIONS, PresetKey } from "@/features/budget-wizard/types";
import { colors, radii, spacing, typography } from "@/lib/theme";

interface WizardStepProfileProps {
  selected: PresetKey | null;
  onSelect: (key: PresetKey) => void;
}

// One tint per option, so the selected state names *which* option is selected
// rather than only that something is. A single shared accent made all four
// rows look identical once chosen, which is the moment the distinction matters
// most — and it left the screen with nothing to distinguish the options by
// while the user was still deciding.
const PRESET_TINT: Record<PresetKey, string> = {
  rented_eating_out: colors.periwinkle,
  with_family: colors.mint,
  own_family: colors.lavender,
  student: colors.mustard,
};

const ICON_TILE_SIZE = 48;
// A comfortable row, not a grid cell: the icon, a title and a line of
// description need vertical room, and four full-width rows are easier to
// compare than a 2×2 grid where the eye has to travel in two directions.
const ROW_MIN_HEIGHT = 84;

/**
 * Screen 2 — one question.
 *
 * v1 asked the user to set a spending level for each of up to 20 categories:
 * as many as 120 decisions, every one of which presumes they already know
 * their own spending. The people who install a budgeting app are precisely the
 * ones who do not, so those answers were guesses being treated as data.
 *
 * This asks about living situation instead — something the user knows for
 * certain, answers in one tap, and which correlates well enough with spending
 * shape to be a defensible starting point. The honest trade is stated plainly
 * on the next screen: it is an estimate, and it will be corrected.
 *
 * Each row carries a description of what the option implies for the budget.
 * Without it the user is matching themselves to a label; with it they are
 * choosing a shape, which is the actual decision being asked of them.
 */
export function WizardStepProfile({ selected, onSelect }: WizardStepProfileProps) {
  return (
    <View style={styles.root}>
      <WizardAmbientGlow />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Text style={styles.title}>Bạn đang sống kiểu nào?</Text>
          <Text style={styles.subtitle}>Tôi sẽ dựng ngân sách khởi điểm từ đây.</Text>
        </View>

        {PRESET_OPTIONS.map((opt) => {
          const active = opt.key === selected;
          const tint = PRESET_TINT[opt.key];

          return (
            <Pressable
              key={opt.key}
              testID={`btn-wizard-preset-${opt.key}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(opt.key)}
              style={[styles.row, active && { borderColor: tint, backgroundColor: `${tint}14` }]}
            >
              <View
                style={[
                  styles.iconTile,
                  { borderColor: `${tint}40` },
                  active && { backgroundColor: `${tint}26`, borderColor: `${tint}80` },
                ]}
              >
                <Text style={styles.icon}>{opt.icon}</Text>
              </View>

              <View style={styles.copy}>
                <Text style={[styles.label, active && { color: tint }]} numberOfLines={1}>
                  {opt.label}
                </Text>
                <Text style={styles.description} numberOfLines={2}>
                  {opt.description}
                </Text>
              </View>

              {/* A filled round check rather than a bare tick: at a glance it
                  reads as "this one", where a floating ✓ read as a decoration
                  on the row it happened to sit in. */}
              <View style={[styles.check, active ? { backgroundColor: tint, borderColor: tint } : null]}>
                {active ? <CheckIcon size={13} color={colors.onGreen} /> : null}
              </View>
            </Pressable>
          );
        })}

        {/* The free-text entry point ("kể tôi nghe cách bạn tiêu tiền") belongs
            to Phase 4 and is NOT rendered here, disabled or otherwise. A
            visible control that does nothing costs more trust than an absent
            one — the user cannot tell a deliberate gap from a broken button. */}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.md },
  head: { gap: spacing.xs, marginBottom: spacing.xs },
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  row: {
    minHeight: ROW_MIN_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  iconTile: {
    width: ICON_TILE_SIZE,
    height: ICON_TILE_SIZE,
    borderRadius: radii.listCard,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: 24 },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  label: { ...typography.body, fontWeight: "700", color: colors.textPrimary },
  description: { ...typography.tiny, color: colors.textSecondary, lineHeight: 15 },
  check: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: "center",
    justifyContent: "center",
  },
});
