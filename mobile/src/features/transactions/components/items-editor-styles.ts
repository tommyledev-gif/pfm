import { StyleSheet } from "react-native";

import { withAlpha } from "@/lib/color";
import { createStyles, radii, spacing, typography } from "@/lib/theme";

// Shared by the Items editor's rows so an Item and an Adjustment read as one
// list. One surface: lines split by hairlines, no card or border per line.
// Hierarchy comes from size, weight and opacity; input fields appear only on
// the line being edited, on a faint fill with no border. Lime is left to the
// footer's CTA.
const MIN_ROW_HEIGHT = 56;
// Smallest tappable size (44pt).
const HIT = 44;

export const useItemsEditorStyles = createStyles((colors) => ({
  // A line at rest. Opaque: a swiped row slides over its action strip.
  row: {
    minHeight: MIN_ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowName: { ...typography.body, color: colors.textPrimary },
  rowNameMissing: { color: colors.textMuted },
  rowSub: { ...typography.tiny, color: colors.textMuted, fontVariant: ["tabular-nums"] },
  rowAmount: { ...typography.body, fontWeight: "600", color: colors.textPrimary },
  rowAmountMissing: { ...typography.caption, color: colors.textMuted },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.surfaceBorder },

  // The expanded line's fields.
  editor: { gap: spacing.md, paddingBottom: spacing.md },
  fieldRow: { flexDirection: "row", gap: spacing.md },
  fieldBlock: { flex: 1, gap: 4 },
  fieldLabel: { ...typography.tiny, color: colors.textSecondary },
  field: {
    minHeight: HIT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radii.listCard,
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
  },
  fieldInput: { flex: 1, paddingVertical: spacing.sm, color: colors.textPrimary, ...typography.body },
  moneyInput: { textAlign: "right", fontVariant: ["tabular-nums"] },
  fieldSuffix: { ...typography.caption, color: colors.textMuted, marginLeft: 4 },
  stepper: {
    minHeight: HIT,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.listCard,
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
  },
  stepButton: { width: HIT, height: HIT, alignItems: "center", justifyContent: "center" },
  stepGlyph: { ...typography.title, color: colors.textPrimary },
  stepDisabled: { opacity: 0.3 },
  stepValue: { flex: 1, textAlign: "center", color: colors.textPrimary, ...typography.body, fontVariant: ["tabular-nums"] },
  textButton: { minHeight: HIT, justifyContent: "center", alignSelf: "flex-start" },
  removeLabel: { ...typography.caption, color: colors.error },

  // Adding and the adjustments section.
  addRow: { minHeight: HIT + spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  addLabel: { ...typography.body, color: colors.textSecondary },
  sectionTitle: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.xs },
  error: { ...typography.tiny, color: colors.error },
  hint: { ...typography.tiny, color: colors.textMuted },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
  },
  chipActive: { backgroundColor: withAlpha(colors.overlayBase, 0.2) },
  chipLabel: { ...typography.caption, color: colors.textSecondary },
  chipLabelActive: { color: colors.textPrimary, fontWeight: "700" },

  // What a removed line leaves for a few seconds.
  undoRow: { minHeight: MIN_ROW_HEIGHT, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  undoLabel: { ...typography.caption, color: colors.textMuted, flex: 1 },
  undoAction: { ...typography.body, fontWeight: "700", color: colors.textPrimary },
}));
