import { useMemo } from "react";
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { ChevronLeftIcon } from "@/components/ui/Icon";
import { Screen } from "@/components/shared/Screen";
import { dayLabelVi, formatDateViShort } from "@/lib/format-date";
import { colors, spacing, typography } from "@/lib/theme";
import { AuditLogRow } from "@/features/audit-log/components/AuditLogRow";
import { useAuditLogsQuery } from "@/features/audit-log/api/use-audit-logs-query";
import { AuditLogEntry } from "@/features/audit-log/types";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { primaryCurrency } from "@/features/wallets/wallet-totals";

interface DaySection {
  key: string;
  dayLabel: string;
  dateLabel: string;
  data: AuditLogEntry[];
}

// Settings → "Nhật ký giao dịch" (specs/transaction-audit-log/spec.md US-02).
// Read-only by design: no undo/restore affordance anywhere on this screen —
// the log is history, not a time machine (that spec's Out of Scope).
export default function AuditLogScreen() {
  const router = useRouter();
  const auditLogs = useAuditLogsQuery();
  const categories = useCategoriesQuery();
  const wallets = useWalletsQuery();

  const categoryNameById = useMemo(
    () => new Map(categories.data?.map((c) => [c.id, c.name])),
    [categories.data],
  );
  const walletNameById = useMemo(() => new Map(wallets.data?.map((w) => [w.id, w.name])), [wallets.data]);
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
          dayLabel: dayLabelVi(entry.created_at),
          dateLabel: formatDateViShort(entry.created_at),
          data: [],
        };
        groups.push(group);
      }
      group.data.push(entry);
    }
    return groups;
  }, [entries]);

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon size={24} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Nhật ký giao dịch</Text>
          <Text style={styles.subtitle}>Lịch sử tạo, sửa và xóa giao dịch của bạn</Text>
        </View>
      </View>

      {auditLogs.isLoading ? (
        <ActivityIndicator color={colors.green} style={styles.loader} />
      ) : (
        <SectionList
          testID="list-audit-logs"
          sections={sections}
          keyExtractor={(entry) => entry.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (auditLogs.hasNextPage && !auditLogs.isFetchingNextPage) auditLogs.fetchNextPage();
          }}
          renderSectionHeader={({ section }) => (
            <View style={styles.dayHeader}>
              <Text style={styles.dayHeaderTitle}>{section.dayLabel}</Text>
              <Text style={styles.dayHeaderDate}>{section.dateLabel}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <AuditLogRow
              entry={item}
              currency={currency}
              resolveCategoryName={(id) => categoryNameById.get(id) ?? "Danh mục"}
              resolveWalletName={(id) => walletNameById.get(id) ?? "Ví"}
            />
          )}
          ListEmptyComponent={
            <Text testID="empty-audit-logs" style={styles.empty}>
              Chưa có thay đổi nào được ghi nhận.
            </Text>
          }
          ListFooterComponent={
            auditLogs.isFetchingNextPage ? <ActivityIndicator color={colors.green} style={styles.loader} /> : null
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerText: { flex: 1, gap: 2 },
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  list: { paddingHorizontal: spacing.xl, paddingBottom: 140, gap: spacing.sm },
  dayHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingTop: spacing.md, paddingBottom: spacing.xs },
  dayHeaderTitle: { ...typography.label, color: colors.textPrimary },
  dayHeaderDate: { ...typography.tiny, color: colors.textMuted },
  loader: { marginVertical: spacing.lg },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xxl },
});
