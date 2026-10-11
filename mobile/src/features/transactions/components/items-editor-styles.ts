import { withAlpha } from "@/lib/color";
import { createStyles, radii, spacing, typography } from "@/lib/theme";

// Shared by the Items editor's line components so an Item row and an
// Adjustment row read as one list.
const CHIP_HEIGHT = 32;
const ICON_BUTTON_SIZE = 32;

export const useItemsEditorStyles = createStyles((colors) => ({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.listCard,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: withAlpha(colors.overlayBase, 0.03),
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  grow: { flex: 1 },
  wrap: { flexWrap: "wrap" },
  input: {
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    ...typography.body,
  },
  quantityInput: { width: 64, textAlign: "center" },
  label: { ...typography.caption, color: colors.textSecondary },
  hint: { ...typography.tiny, color: colors.textMuted },
  error: { ...typography.tiny, color: colors.error },
  sectionTitle: { ...typography.label, color: colors.textPrimary, marginTop: spacing.md },
  chip: {
    height: CHIP_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
  },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipLabel: { ...typography.caption, color: colors.textSecondary },
  chipLabelActive: { color: colors.onGreen },
  iconButton: {
    width: ICON_BUTTON_SIZE,
    height: ICON_BUTTON_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
  },
  iconButtonDisabled: { opacity: 0.3 },
}));
