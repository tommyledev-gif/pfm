import { Pressable, View } from "react-native";

import { ChevronLeftIcon, CloseIcon } from "@/components/ui/Icon";
import { withAlpha } from "@/lib/color";
import { spacing, createStyles, useColors } from "@/lib/theme";

// Both side controls share one square slot so the pills between them are
// centred on the screen whichever controls are showing.
const SLOT_SIZE = 36;
const ICON_SIZE = 20;

interface WizardProgressHeaderProps {
  step: number;
  totalSteps: number;
  onClose: () => void;
  /** Omitted on the first step, where there is nothing behind to go back to and
   *  ✕ is the only honest exit. */
  onBack?: () => void;
}

// The progress bar + dismiss control shown above every numbered step of
// BudgetWizardModal — split out purely to keep that file under the
// project's 300-line cap.
export function WizardProgressHeader({ step, totalSteps, onClose, onBack }: WizardProgressHeaderProps) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.header}>
      {/* Leading, before the progress pills: back moves along the same axis the
          pills read in, so its direction matches what it does. ✕ stays on the
          far side because leaving and stepping back are different intents and
          should not sit next to each other.
          ⚠️ The slot stays when there is no back button: dropping it shifted
          the pills off centre on step 1 and made them jump on step 2. Both
          glyphs are SVG icons in same-size slots — the old text "‹" and "✕"
          had different line boxes and never lined up with the pills. */}
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={8}
          style={styles.slot}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          testID="btn-wizard-back"
        >
          <ChevronLeftIcon size={ICON_SIZE} color={colors.textSecondary} />
        </Pressable>
      ) : (
        <View style={styles.slot} />
      )}
      {/* One pill per step rather than a continuous bar. With only three steps
          a filling bar reads as a percentage of unknown work, while three
          discrete pills answer the question the user actually has: how many
          screens are left. */}
      <View style={styles.progressTrack}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <View key={i} style={[styles.progressPill, i < step && styles.progressPillOn]} />
        ))}
      </View>
      <Pressable
        onPress={onClose}
        hitSlop={8}
        style={styles.slot}
        accessibilityRole="button"
        accessibilityLabel="Đóng"
        testID="btn-wizard-dismiss"
      >
        <CloseIcon size={ICON_SIZE} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  slot: { width: SLOT_SIZE, height: SLOT_SIZE, alignItems: "center", justifyContent: "center" },
  progressTrack: { flex: 1, flexDirection: "row", gap: spacing.xs },
  progressPill: { flex: 1, height: 4, borderRadius: 2, backgroundColor: withAlpha(colors.overlayBase, 0.08) },
  progressPillOn: { backgroundColor: colors.green },
}));
