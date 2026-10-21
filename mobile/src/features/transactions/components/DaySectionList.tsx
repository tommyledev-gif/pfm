import { ReactElement, RefObject, useMemo } from "react";
import { SectionList, SectionListProps, View } from "react-native";
import Animated from "react-native-reanimated";

import { useListEntrance } from "@/components/motion/MotionView";
import { spacing, createStyles } from "@/lib/theme";
import { DaySection } from "@/features/transactions/day-sections";
import { Transaction } from "@/features/transactions/types";
import { DayFoldRow } from "@/features/transactions/components/DayFoldRow";
import { TransactionDayHeader } from "@/features/transactions/components/TransactionDayHeader";
import { useCollapsedDays } from "@/features/transactions/hooks/use-collapsed-days";

type OwnProps =
  | "sections"
  | "renderItem"
  | "renderSectionHeader"
  | "renderSectionFooter"
  | "keyExtractor"
  | "ListEmptyComponent"
  | "ListFooterComponent";

interface DaySectionListProps extends Omit<SectionListProps<Transaction, DaySection>, OwnProps> {
  listRef: RefObject<SectionList<Transaction, DaySection> | null>;
  sections: DaySection[];
  days: ReturnType<typeof useCollapsedDays>;
  /** Changes with the filters: the new result set staggers in like the first. */
  replayKey: string;
  renderRow: (item: Transaction) => ReactElement;
  /** In place of ListEmptyComponent / ListFooterComponent, which get spaced here. */
  empty: ReactElement;
  footer: ReactElement;
}

/**
 * The Transactions screen's day-grouped list: day headers that fold their
 * day, rows that fold away and grow back with it (DayFoldRow), and a
 * staggered entrance for each new result set.
 *
 * ⚠️ No `gap` on the content container. A gap sits between the list's cell
 * wrappers, where a folding row cannot shrink it, so every cell carries the
 * space above itself instead: rows inside their fold box, and the headers,
 * section ends, empty state and footer through `cellTop` here. Every pair of
 * neighbours ends up exactly as far apart as the old gap put them.
 */
export function DaySectionList({
  listRef,
  sections,
  days,
  replayKey,
  renderRow,
  empty,
  footer,
  ...listProps
}: DaySectionListProps) {
  const styles = useStyles();
  const rowEntrance = useListEntrance(replayKey);
  const { toggleDay, isRevealing, reduceMotion } = days;

  // Each header and row's place in the list from the top, so the stagger runs
  // down the screen rather than restarting in every day.
  const order = useMemo(() => {
    const map = new Map<string, number>();
    let next = 0;
    for (const section of sections) {
      map.set(`day:${section.key}`, next++);
      for (const item of section.data) map.set(item.id, next++);
    }
    return map;
  }, [sections]);

  return (
    <SectionList
      ref={listRef}
      {...listProps}
      sections={sections}
      keyExtractor={(t) => t.id}
      renderSectionHeader={({ section }) => (
        <Animated.View style={styles.cellTop} entering={rowEntrance(order.get(`day:${section.key}`) ?? 0)}>
          {section.dayLabel ? (
            <TransactionDayHeader
              section={section}
              onToggle={() => toggleDay(section.key)}
              reduceMotion={reduceMotion}
            />
          ) : null}
        </Animated.View>
      )}
      // Empty: only the space a section's end used to get from the gap.
      renderSectionFooter={() => <View style={styles.cellTop} />}
      renderItem={({ item, section, index }) => (
        <DayFoldRow
          folding={section.folding}
          revealing={isRevealing(section.key)}
          index={index}
          reduceMotion={reduceMotion}
          entering={rowEntrance(order.get(item.id) ?? 0)}
        >
          {renderRow(item)}
        </DayFoldRow>
      )}
      ListEmptyComponent={<View style={styles.cellTop}>{empty}</View>}
      ListFooterComponent={<View style={styles.cellTop}>{footer}</View>}
    />
  );
}

const useStyles = createStyles(() => ({
  cellTop: { paddingTop: spacing.md },
}));
