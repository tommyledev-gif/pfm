import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, SectionList, Text } from "react-native";
import Animated from "react-native-reanimated";

import { useAppendEntrance, useListEntrance } from "@/components/motion/MotionView";
import { GroupedListCell, ListSectionHeader } from "@/components/ui/grouped-list";
import { useFabBottom } from "@/components/ui/Fab";
import { Screen } from "@/components/shared/Screen";
import { ScreenLoader } from "@/components/shared/ScreenLoader";
import { ScreenHeader } from "@/components/shared/ScreenHeader";
import { dayLabel, formatDateGroupHeader } from "@/lib/format-date";
import { categoryLabel } from "@/features/categories/category-label";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { AuditLogRow } from "@/features/audit-logs/components/AuditLogRow";
import { AuditLogsEmptyState } from "@/features/audit-logs/components/AuditLogsEmptyState";
import { useAuditLogsQuery } from "@/features/audit-logs/api/use-audit-logs-query";
import { AuditLogEntry } from "@/features/audit-logs/types";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { primaryCurrency } from "@/features/wallets/wallet-totals";
import { useRefresh } from "@/lib/use-refresh";

interface DaySection {
  key: string;
  dayLabel: string;
  dateLabel: string;
  data: AuditLogEntry[];
}

// Settings → "Nhật ký giao dịch" (specs/transaction-audit-log/spec.md US-02).
// Read-only by design: no undo/restore affordance anywhere on this screen —
// the log is history, not a time machine (that spec's Out of Scope).
// Each day is one rounded group; its entries are hairline-split rows.
export default function AuditLogsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const auditLogs = useAuditLogsQuery();
  // Clear of the floating BottomNav, so the oldest entry is never under it.
  const navClearance = useFabBottom();
  // The first page staggers in once; each later page fades in under it.
  const replayKey = auditLogs.isLoading ? "loading" : "ready";
  const enter = useListEntrance(replayKey);
  const categories = useCategoriesQuery();
  const wallets = useWalletsQuery();

  // categoryLabel: a built-in category reads in the app language; t: rebuilt on a switch.
  const categoryNameById = useMemo(
    () => new Map(categories.data?.map((c) => [c.id, categoryLabel(c)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories.data, t],
  );
  const walletNameById = useMemo(() => new Map(wallets.data?.map((w) => [w.id, w.name])), [wallets.data]);
  // The log renders category and wallet *names*, so a refresh that only
  // refetched the log itself would still show "Danh mục" for a category
  // created since the screen mounted.
  const { refreshControl } = useRefresh([auditLogs, categories, wallets]);
  const currency = (wallets.data ? primaryCurrency(wallets.data) : undefined) ?? "VND";

  const entries = useMemo(
    () => auditLogs.data?.pages.flatMap((page) => page.data) ?? [],
    [auditLogs.data],
  );

  // Same day-grouping shape the Transactions screen uses, keyed on when the
  // change was recorded (created_at) rather than when the money moved.
  const sections: DaySection[] = useMemo(() => {
    const groups: DaySection[] = [];
    for (const entry of entries) {
      const dayKey = entry.created_at.slice(0, 10);
      let group = groups.find((g) => g.key === dayKey);
      if (!group) {
        group = {
          key: dayKey,
          dayLabel: dayLabel(entry.created_at),
          dateLabel: formatDateGroupHeader(entry.created_at),
          data: [],
        };
        groups.push(group);
      }
      group.data.push(entry);
    }
    return groups;
    // t: the day labels are text, rebuilt in the new language on a switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, t]);

  // Each day's first entry's position in the whole log, for the stagger.
  const sectionStart = useMemo(() => {
    const starts = new Map<string, number>();
    let offset = 0;
    for (const section of sections) {
      starts.set(section.key, offset);
      offset += section.data.length;
    }
    return starts;
  }, [sections]);
  const cellKeys = useMemo(
    () => sections.flatMap((section) => [`day:${section.key}`, ...section.data.map((entry) => entry.id)]),
    [sections],
  );
  const appendEnter = useAppendEntrance(cellKeys, replayKey);

  return (
    <Screen style={styles.screen}>
      <ScreenHeader title={t("nav.title.auditLogs")} subtitle={t("auditLogs.subtitle")} />

      {auditLogs.isLoading ? (
        <ScreenLoader />
      ) : (
        <SectionList
          testID="list-audit-logs"
          sections={sections}
          keyExtractor={(entry) => entry.id}
          contentContainerStyle={[styles.list, { paddingBottom: navClearance }]}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          // A screen ahead, so the next page is usually in before the end is reached.
          onEndReachedThreshold={1}
          onEndReached={() => {
            if (auditLogs.hasNextPage && !auditLogs.isFetchingNextPage) auditLogs.fetchNextPage();
          }}
          renderSectionHeader={({ section }) => (
            <Animated.View
              style={section.key !== sections[0]?.key && styles.laterDay}
              entering={appendEnter(`day:${section.key}`)}
            >
              <ListSectionHeader
                title={section.dayLabel}
                trailing={<Text style={styles.dayHeaderDate}>{section.dateLabel}</Text>}
              />
            </Animated.View>
          )}
          renderItem={({ item, index, section }) => (
            <GroupedListCell
              index={index}
              count={section.data.length}
              entering={appendEnter(item.id) ?? enter(index + (sectionStart.get(section.key) ?? 0))}
            >
              <AuditLogRow
                entry={item}
                currency={currency}
                resolveCategoryName={(id) => categoryNameById.get(id) ?? t("auditLogs.fallback.category")}
                resolveWalletName={(id) => walletNameById.get(id) ?? t("common.field.wallet")}
              />
            </GroupedListCell>
          )}
          ListEmptyComponent={<AuditLogsEmptyState />}
          ListFooterComponent={
            auditLogs.isFetchingNextPage ? <ActivityIndicator color={colors.green} style={styles.loader} /> : null
          }
        />
      )}
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  list: { paddingHorizontal: spacing.xl },
  laterDay: { paddingTop: spacing.xxl },
  dayHeaderDate: { ...typography.tiny, color: colors.textMuted },
  loader: { marginVertical: spacing.lg },
}));
