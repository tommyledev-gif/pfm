import { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { ChevronRightIcon, LockIcon } from "@/components/ui/Icon";
import { FieldError } from "@/components/ui/FieldError";
import { withAlpha } from "@/lib/color";
import { createStyles, radii, spacing, typography, useColors } from "@/lib/theme";

interface EntryTileProps {
  label: string;
  summary: string;
  /** Second line under the summary (an amount, a reason). */
  detail?: string;
  /** Nothing filled in yet: the summary reads as a placeholder. */
  muted?: boolean;
  icon?: ReactNode;
  onPress: () => void;
  /** Cannot open now (still loading). The chevron stays. */
  disabled?: boolean;
  /** Cannot open at all for this transaction: a lock replaces the chevron. */
  locked?: boolean;
  /** Half-width tile of a two-tile row, sized for a two-line summary. */
  compact?: boolean;
  error?: string;
  testID?: string;
  accessibilityLabel?: string;
}

const CHEVRON_SIZE = 18;
const COMPACT_TRAILING_SIZE = 16;
// Fits a summary plus its detail line, so two tiles side by side keep the
// same height whether or not either one has a detail.
const COMPACT_MIN_HEIGHT = 58;

/**
 * A form's door to a panel: label, bordered tile with the current value, and
 * a chevron. The full-width form uses it for "Các món"; the AI chat's edit
 * sheet puts two compact ones side by side ("Vị trí" | "Các món").
 */
export function EntryTile({
  label,
  summary,
  detail,
  muted,
  icon,
  onPress,
  disabled,
  locked,
  compact,
  error,
  testID,
  accessibilityLabel,
}: EntryTileProps) {
  const colors = useColors();
  const styles = useStyles();
  const trailingSize = compact ? COMPACT_TRAILING_SIZE : CHEVRON_SIZE;

  return (
    <View style={compact ? styles.compactColumn : undefined}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: Boolean(disabled || locked) }}
        disabled={disabled || locked}
        onPress={onPress}
        style={({ pressed }) => [
          styles.tile,
          compact && styles.tileCompact,
          locked && styles.tileLocked,
          pressed && styles.pressed,
        ]}
      >
        {icon}
        <View style={styles.texts}>
          <Text
            style={[compact ? styles.valueCompact : styles.value, muted && styles.placeholder]}
            numberOfLines={compact ? 1 : undefined}
          >
            {summary}
          </Text>
          {detail ? (
            <Text style={styles.detail} numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
        </View>
        {locked ? (
          <LockIcon size={trailingSize} color={colors.textMuted} />
        ) : (
          <ChevronRightIcon size={trailingSize} color={colors.textMuted} />
        )}
      </Pressable>
      <FieldError message={error} />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  // minWidth 0 lets a long place name ellipsize instead of widening the tile.
  compactColumn: { flex: 1, minWidth: 0 },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.listCard,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
  },
  // A half-width tile is ~170dp on a 390dp phone: tighter gaps leave the text
  // room for "Chỉ ghim lúc tạo" or an amount on one line.
  tileCompact: { paddingHorizontal: spacing.md, gap: spacing.xs, minHeight: COMPACT_MIN_HEIGHT },
  tileLocked: { backgroundColor: withAlpha(colors.overlayBase, 0.03) },
  pressed: { opacity: 0.85 },
  texts: { flex: 1, minWidth: 0, gap: 2 },
  value: { ...typography.body, color: colors.textPrimary },
  valueCompact: { ...typography.label, color: colors.textPrimary },
  placeholder: { color: colors.textMuted },
  detail: { ...typography.tiny, color: colors.textMuted },
}));
