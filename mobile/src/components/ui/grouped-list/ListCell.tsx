import { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import { withAlpha } from "@/lib/color";
import { createStyles } from "@/lib/theme";
import {
  LIST_ROW_PADDING_X,
  LIST_ROW_PADDING_Y,
  LIST_SEPARATOR_ALPHA,
  useHasRowAbove,
} from "@/components/ui/grouped-list/list-metrics";

/**
 * The hairline above a row, starting at `inset` and running to the
 * container's right edge (iOS separators do not stop short on the right).
 * Absolutely placed, so it never adds to the row's height; drawn only when
 * there is a row above it in the same group.
 */
export function RowSeparator({ inset }: { inset: number }) {
  const styles = useStyles();
  const hasRowAbove = useHasRowAbove();
  if (!hasRowAbove) return null;
  return <View pointerEvents="none" style={[styles.separator, { left: inset }]} />;
}

interface ListCellProps {
  children: ReactNode;
  /** Where the hairline above starts. Defaults to the cell's own padding. */
  separatorInset?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * A row-sized slot in a group for anything that is not a plain row: a
 * spinner, a status line, a search field, a picker. Same padding and
 * separator as ListRow, so it sits in the list like one.
 */
export function ListCell({ children, separatorInset = LIST_ROW_PADDING_X, style, testID }: ListCellProps) {
  const styles = useStyles();
  return (
    <View style={[styles.cell, style]} testID={testID}>
      <RowSeparator inset={separatorInset} />
      {children}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  separator: {
    position: "absolute",
    top: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: withAlpha(colors.overlayBase, LIST_SEPARATOR_ALPHA),
  },
  cell: { paddingHorizontal: LIST_ROW_PADDING_X, paddingVertical: LIST_ROW_PADDING_Y },
}));
