import { ReactNode } from "react";
import { AccessibilityRole, ActivityIndicator, Pressable, Text, View } from "react-native";

import { withAlpha } from "@/lib/color";
import { createStyles, typography, useColors } from "@/lib/theme";
import { ChevronGlyph } from "@/components/ui/grouped-list/list-icons";
import { RowSeparator } from "@/components/ui/grouped-list/ListCell";
import { ListIconTile } from "@/components/ui/grouped-list/ListIconTile";
import {
  LIST_DISABLED_OPACITY,
  LIST_ICON_TILE_SIZE,
  LIST_PRESSED_ALPHA,
  LIST_ROW_GAP,
  LIST_ROW_MIN_HEIGHT,
  LIST_ROW_PADDING_X,
  LIST_ROW_PADDING_Y,
  ListGlyph,
  textInset,
} from "@/components/ui/grouped-list/list-metrics";

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Grey text on the right: the current value of a setting. */
  value?: string;
  /** The value in another colour — e.g. green for an empty "Thêm" that invites a tap. */
  valueColor?: string;
  /** A glyph in a tinted rounded-square tile at the start. */
  icon?: ListGlyph;
  /** The tile's colour, a palette token's value. Left out: a grey tile. */
  tone?: string;
  /** Anything else at the start (an Avatar). Replaces the icon tile. */
  leading?: ReactNode;
  /** Width of a custom `leading`, so the hairline lines up with the text. */
  leadingWidth?: number;
  /** On the right, before the chevron: a Toggle, a text button, avatars. */
  trailing?: ReactNode;
  /** Under the title and subtitle, in the text column (inline actions). */
  children?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Defaults to on for a tappable row that is not destructive. */
  chevron?: boolean;
  /** "destructive": red label, no chevron. "accent": a green label for an add/do row. */
  variant?: "default" | "destructive" | "accent";
  /** Dimmed and not tappable. */
  disabled?: boolean;
  /** A spinner in the trailing slot; the row stops taking taps meanwhile. */
  loading?: boolean;
  titleLines?: number;
  subtitleLines?: number;
  /** "middle" keeps an email's domain readable when it does not fit. */
  subtitleEllipsizeMode?: "head" | "middle" | "tail";
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  testID?: string;
}

/**
 * One row of an inset-grouped list: [icon tile] title/subtitle [value]
 * [trailing] [chevron]. Draws the hairline above itself when it is not the
 * first in its group (ListSection / GroupedListCell tell it), starting where
 * the text starts. A tappable row washes over while held instead of
 * scaling: inside a shared container, one row shrinking away from its
 * neighbours reads as a glitch.
 */
export function ListRow({
  title,
  subtitle,
  value,
  valueColor,
  icon,
  tone,
  leading,
  leadingWidth,
  trailing,
  children,
  onPress,
  onLongPress,
  chevron,
  variant = "default",
  disabled = false,
  loading = false,
  titleLines = 2,
  subtitleLines = 2,
  subtitleEllipsizeMode,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole,
  testID,
}: ListRowProps) {
  const colors = useColors();
  const styles = useStyles();
  const pressable = onPress !== undefined || onLongPress !== undefined;
  const showChevron = chevron ?? (pressable && variant !== "destructive");
  const leadingNode = leading ?? (icon ? <ListIconTile icon={icon} tone={tone} /> : null);
  const inset = textInset(leading ? (leadingWidth ?? LIST_ICON_TILE_SIZE) : icon ? LIST_ICON_TILE_SIZE : undefined);

  const content = (
    <>
      <RowSeparator inset={inset} />
      {leadingNode}
      <View style={styles.text}>
        <Text
          style={[styles.title, variant === "destructive" && styles.titleDestructive, variant === "accent" && styles.titleAccent]}
          numberOfLines={titleLines}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={subtitleLines} ellipsizeMode={subtitleEllipsizeMode}>
            {subtitle}
          </Text>
        ) : null}
        {children}
      </View>
      {value ? (
        <Text style={[styles.value, valueColor !== undefined && { color: valueColor }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {loading ? (
        <ActivityIndicator size="small" color={variant === "destructive" ? colors.peach : colors.textSecondary} />
      ) : (
        trailing
      )}
      {showChevron ? <ChevronGlyph size={14} weight="bold" color={colors.textMuted} /> : null}
    </>
  );

  if (!pressable) {
    return (
      <View style={[styles.row, disabled && styles.disabled]} testID={testID} accessibilityLabel={accessibilityLabel}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled || loading}
      accessibilityRole={accessibilityRole ?? "button"}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.disabled]}
    >
      {content}
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: LIST_ROW_GAP,
    minHeight: LIST_ROW_MIN_HEIGHT,
    paddingHorizontal: LIST_ROW_PADDING_X,
    paddingVertical: LIST_ROW_PADDING_Y,
  },
  pressed: { backgroundColor: withAlpha(colors.overlayBase, LIST_PRESSED_ALPHA) },
  disabled: { opacity: LIST_DISABLED_OPACITY },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...typography.body, fontWeight: "500", color: colors.textPrimary },
  titleDestructive: { color: colors.peach },
  titleAccent: { color: colors.green },
  subtitle: { ...typography.caption, fontWeight: "500", color: colors.textSecondary },
  value: { ...typography.body, fontWeight: "400", color: colors.textSecondary, flexShrink: 1, maxWidth: "50%" },
}));
