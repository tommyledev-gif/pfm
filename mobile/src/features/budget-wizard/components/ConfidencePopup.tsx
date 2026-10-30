import { Modal, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { radii, spacing, typography, createStyles } from "@/lib/theme";
import { ConfidenceBadge } from "@/features/budget-wizard/types";

const MAX_LEVEL = 3;

interface ConfidencePopupProps {
  visible: boolean;
  categoryName: string;
  badge: ConfidenceBadge | null;
  onClose: () => void;
}

/**
 * Where a proposed figure came from, shown when the user asks.
 *
 * ⚠️ This is where the filled/empty level dots live now. On the row they were
 * unlabelled and ambiguous — a rating, a progress bar, a signal meter, take
 * your pick. Here they sit directly above the sentence that defines them, so
 * they are a summary of something stated rather than a glyph to be decoded.
 */
export function ConfidencePopup({ visible, categoryName, badge, onClose }: ConfidencePopupProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  return (
    <Modal visible={visible && badge !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.card} testID="popup-wizard-confidence">
          <Text style={styles.category} numberOfLines={1}>
            {categoryName}
          </Text>

          {badge ? (
            <>
              <View style={styles.levelRow}>
                <View style={styles.dots}>
                  {Array.from({ length: MAX_LEVEL }).map((_, i) => (
                    <View key={i} style={[styles.dot, i < badge.level && styles.dotFilled]} />
                  ))}
                </View>
                <Text style={styles.levelLabel}>{badge.label}</Text>
              </View>
              <Text style={styles.explanation}>{badge.explanation}</Text>
            </>
          ) : null}

          <Pressable onPress={onClose} hitSlop={8} style={styles.closeRow}>
            <Text style={styles.closeLabel}>{t("common.action.gotIt")}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = createStyles((colors) => ({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.hero,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  category: { ...typography.label, color: colors.textMuted },
  levelRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dots: { flexDirection: "row", gap: 4 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.textMuted,
  },
  dotFilled: { backgroundColor: colors.green, borderColor: colors.green },
  levelLabel: { ...typography.cardTitle, color: colors.textPrimary },
  explanation: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
  closeRow: { alignSelf: "flex-end", paddingTop: spacing.xs },
  closeLabel: { ...typography.label, color: colors.green },
}));
