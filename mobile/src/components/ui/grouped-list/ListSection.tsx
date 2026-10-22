import { Children, ReactNode, isValidElement } from "react";
import { StyleProp, Text, View, ViewStyle } from "react-native";

import { withAlpha } from "@/lib/color";
import { createStyles, radii, spacing, typography } from "@/lib/theme";
import { LIST_ROW_PADDING_X, ListPositionContext } from "@/components/ui/grouped-list/list-metrics";

interface ListSectionProps {
  /** A few words over the group, in sentence case ("Tài khoản"). */
  header?: string;
  /** Under the group: what its rows do, when the labels alone do not say. */
  footer?: ReactNode;
  /** "danger" colours a string footer red (a form's error line). */
  footerTone?: "default" | "danger";
  /** ListRow, ListToggleRow, ListCell. null / false children are skipped. */
  children: ReactNode;
  /**
   * The group sits on a sheet (a Drawer), not the page: the sheet is the same
   * surface colour, so the group takes a faint wash of its own to show.
   */
  onSheet?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * One group of an inset-grouped list: an optional header, ONE rounded
 * container holding its rows, an optional footer. Each direct child is told
 * its position (a fragment counts as one), which is how rows know to draw
 * the hairline above themselves; a list rendered with .map() as a direct
 * child counts row by row.
 */
export function ListSection({
  header,
  footer,
  footerTone = "default",
  children,
  onSheet = false,
  style,
  testID,
}: ListSectionProps) {
  const styles = useStyles();
  const rows = Children.toArray(children);

  return (
    <View style={style} testID={testID}>
      {header ? <ListSectionHeader title={header} /> : null}
      <View style={[styles.container, onSheet && styles.containerOnSheet]}>
        {rows.map((row, index) => (
          <ListPositionContext.Provider key={isValidElement(row) && row.key !== null ? row.key : index} value={index}>
            {row}
          </ListPositionContext.Provider>
        ))}
      </View>
      {footer ? <ListSectionFooter tone={footerTone}>{footer}</ListSectionFooter> : null}
    </View>
  );
}

/** The header line on its own, e.g. for a SectionList's renderSectionHeader. */
export function ListSectionHeader({ title, trailing }: { title: string; trailing?: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.header}>
      <Text style={styles.headerLabel} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
      {trailing}
    </View>
  );
}

/** The footer on its own. A string becomes muted caption text. */
export function ListSectionFooter({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "danger" }) {
  const styles = useStyles();
  return (
    <View style={styles.footer}>
      {typeof children === "string" ? (
        <Text style={[styles.footerLabel, tone === "danger" && styles.footerDanger]}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  // No border: the surface against the page ground is the edge, as on iOS.
  // Clipping keeps a pressed row's wash inside the rounded corners.
  container: { backgroundColor: colors.surface, borderRadius: radii.card, overflow: "hidden" },
  containerOnSheet: { backgroundColor: withAlpha(colors.overlayBase, 0.05) },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: LIST_ROW_PADDING_X,
    paddingBottom: spacing.sm,
  },
  headerLabel: { flex: 1, ...typography.caption, color: colors.textSecondary },
  footer: { paddingHorizontal: LIST_ROW_PADDING_X, paddingTop: spacing.sm },
  footerLabel: { ...typography.caption, fontWeight: "500", color: colors.textSecondary },
  footerDanger: { color: colors.peach },
}));
