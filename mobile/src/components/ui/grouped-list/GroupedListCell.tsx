import { ReactNode } from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import type { EntryOrExitLayoutType } from "react-native-reanimated";

import { createStyles, radii } from "@/lib/theme";
import { ListPositionContext } from "@/components/ui/grouped-list/list-metrics";

interface GroupedListCellProps {
  /** Position of this row in its group (a SectionList's per-section index). */
  index: number;
  /** Rows in the group: the last one gets the rounded bottom corners. */
  count: number;
  children: ReactNode;
  /** From useListEntrance: the row's stagger-in, first paint only. */
  entering?: EntryOrExitLayoutType;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * ListSection's container, one row at a time, for FlatList / SectionList
 * items: each row paints its own slice of the rounded group (top corners on
 * the first, bottom corners on the last) so a virtualised list still reads
 * as one container, with the hairlines between rows.
 */
export function GroupedListCell({ index, count, children, entering, style, testID }: GroupedListCellProps) {
  const styles = useStyles();
  return (
    <Animated.View
      entering={entering}
      style={[styles.cell, index === 0 && styles.first, index === count - 1 && styles.last, style]}
      testID={testID}
    >
      <ListPositionContext.Provider value={index}>{children}</ListPositionContext.Provider>
    </Animated.View>
  );
}

const useStyles = createStyles((colors) => ({
  cell: { backgroundColor: colors.surface, overflow: "hidden" },
  first: { borderTopLeftRadius: radii.card, borderTopRightRadius: radii.card },
  last: { borderBottomLeftRadius: radii.card, borderBottomRightRadius: radii.card },
}));
