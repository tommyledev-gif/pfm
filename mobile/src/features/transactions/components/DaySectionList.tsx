import { ReactElement, RefObject, memo, useMemo, useRef } from "react";
import { SectionList, SectionListProps, View } from "react-native";
import Animated from "react-native-reanimated";

import { useAppendEntrance, useListEntrance } from "@/components/motion/MotionView";
import { spacing, createStyles } from "@/lib/theme";
import { DaySection, reuseUnchangedSections } from "@/features/transactions/day-sections";
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
  /** Must be stable (useCallback): rows are memoized on it. */
  renderRow: (item: Transaction) => ReactElement;
  /** In place of ListEmptyComponent / ListFooterComponent, which get spaced here. */
  empty: ReactElement;
  footer: ReactElement;
}

type RowEntrance = ReturnType<typeof useListEntrance>;
type AppendEntrance = ReturnType<typeof useAppendEntrance>;

const transactionKey = (t: Transaction) => t.id;
// Screens of rows kept mounted around the viewport; the default 21 grew with
// every page loaded.
const WINDOW_SIZE = 11;

/**
 * The Transactions screen's day-grouped list: day headers that fold their
 * day, rows that fold away and grow back with it (DayFoldRow), a staggered
 * entrance for each new result set, and a fade, row after row, for each page
 * loaded below it (useAppendEntrance).
 *
 * ⚠️ No `gap` on the content container. A gap sits between the list's cell
 * wrappers, where a folding row cannot shrink it, so every cell carries the
 * space above itself instead: rows inside their fold box, and the headers,
 * section ends, empty state and footer through `cellTop` here.
 *
 * Rows and headers are memoized cells: SectionList hands its cells a new
 * render function on every render, which re-rendered every mounted row on
 * each keystroke, refetch and fold.
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

  // The days as last handed to the list: one a new page did not touch keeps
  // its object, so its memoized header does not re-render.
  const shownSections = useRef<DaySection[]>([]);
  const stableSections = useMemo(() => {
    const next = reuseUnchangedSections(shownSections.current, sections);
    shownSections.current = next;
    return next;
  }, [sections]);

  // Each header and row's place in the list from the top, so the stagger runs
  // down the screen rather than restarting in every day.
  const order = useMemo(() => {
    const map = new Map<string, number>();
    let next = 0;
    for (const section of stableSections) {
      map.set(dayCellKey(section.key), next++);
      for (const item of section.data) map.set(item.id, next++);
    }
    return map;
  }, [stableSections]);
  const cellKeys = useMemo(() => [...order.keys()], [order]);
  const appendEntrance = useAppendEntrance(cellKeys, replayKey);

  return (
    <SectionList
      ref={listRef}
      windowSize={WINDOW_SIZE}
      {...listProps}
      sections={stableSections}
      keyExtractor={transactionKey}
      renderSectionHeader={({ section }) => (
        <DayHeaderCell
          section={section}
          entranceIndex={order.get(dayCellKey(section.key)) ?? 0}
          rowEntrance={rowEntrance}
          appendEntrance={appendEntrance}
          toggleDay={toggleDay}
          reduceMotion={reduceMotion}
        />
      )}
      // Empty: only the space a section's end used to get from the gap.
      renderSectionFooter={() => <View style={styles.cellTop} />}
      renderItem={({ item, section, index }) => (
        <DayRowCell
          item={item}
          index={index}
          folding={section.folding}
          revealing={isRevealing(section.key)}
          reduceMotion={reduceMotion}
          entranceIndex={order.get(item.id) ?? 0}
          rowEntrance={rowEntrance}
          appendEntrance={appendEntrance}
          renderRow={renderRow}
        />
      )}
      ListEmptyComponent={<View style={styles.cellTop}>{empty}</View>}
      ListFooterComponent={<View style={styles.cellTop}>{footer}</View>}
    />
  );
}

// A day header's key among the list's cells, apart from the rows' ids.
const dayCellKey = (dayKey: string) => `day:${dayKey}`;

interface DayHeaderCellProps {
  section: DaySection;
  entranceIndex: number;
  rowEntrance: RowEntrance;
  appendEntrance: AppendEntrance;
  toggleDay: (key: string) => void;
  reduceMotion: boolean;
}

const DayHeaderCell = memo(function DayHeaderCell({
  section,
  entranceIndex,
  rowEntrance,
  appendEntrance,
  toggleDay,
  reduceMotion,
}: DayHeaderCellProps) {
  const styles = useStyles();
  return (
    <Animated.View
      style={styles.cellTop}
      entering={appendEntrance(dayCellKey(section.key)) ?? rowEntrance(entranceIndex)}
    >
      {section.dayLabel ? (
        <TransactionDayHeader section={section} onToggle={() => toggleDay(section.key)} reduceMotion={reduceMotion} />
      ) : null}
    </Animated.View>
  );
});

interface DayRowCellProps {
  item: Transaction;
  index: number;
  folding: boolean;
  revealing: boolean;
  reduceMotion: boolean;
  entranceIndex: number;
  rowEntrance: RowEntrance;
  appendEntrance: AppendEntrance;
  renderRow: (item: Transaction) => ReactElement;
}

const DayRowCell = memo(function DayRowCell({
  item,
  index,
  folding,
  revealing,
  reduceMotion,
  entranceIndex,
  rowEntrance,
  appendEntrance,
  renderRow,
}: DayRowCellProps) {
  return (
    <DayFoldRow
      folding={folding}
      revealing={revealing}
      index={index}
      reduceMotion={reduceMotion}
      entering={appendEntrance(item.id) ?? rowEntrance(entranceIndex)}
    >
      {renderRow(item)}
    </DayFoldRow>
  );
});

const useStyles = createStyles(() => ({
  cellTop: { paddingTop: spacing.md },
}));
