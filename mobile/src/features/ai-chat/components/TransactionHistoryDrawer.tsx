import { useMemo } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { formatCurrencyTruncated } from "@/lib/currency";
import { formatDateShort, formatTime } from "@/lib/format-date";
import { TranslationKey } from "@/lib/i18n";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useAuditLogsQuery } from "@/features/audit-logs/api/use-audit-logs-query";
import { AuditAction, AuditLogEntry } from "@/features/audit-logs/types";
import { proposalAmountSign } from "@/features/ai-chat/proposal-kind";
import { TombstoneKind } from "@/features/ai-chat/tombstone";
import { ChatMessage } from "@/features/ai-chat/types";
import { AuditItemsDiff } from "@/features/audit-logs/components/AuditItemsDiff";

const ACTION_LABEL: Record<AuditAction, TranslationKey> = {
  create: "chat.history.action.create",
  update: "chat.history.action.update",
  delete: "chat.history.action.delete",
};

const FIELD_LABEL: Record<string, TranslationKey> = {
  amount: "common.field.amount",
  category_id: "common.field.category",
  occurred_at: "common.field.date",
  note: "common.field.note",
  wallet_id: "common.field.wallet",
  type: "common.field.type",
};

const TYPE_LABEL: Record<string, TranslationKey> = {
  income: "common.txType.incomeShort",
  transfer: "common.txType.transfer",
};

interface TransactionHistoryDrawerProps {
  message: ChatMessage | null;
  kind: TombstoneKind | null;
  currency: string;
  resolveCategoryName: (id: string) => string;
  resolveWalletName: (id: string) => string;
  onClose: () => void;
}

/**
 * Everything that happened to a removed proposal.
 *
 * ⚠️ For a deleted transaction this reads the SERVER's history, not the
 * message's own edit trail. The message only ever saw edits made through the
 * chat card; a transaction edited from the Transactions screen has changes the
 * thread never witnessed, and a history that silently omits them is worse than
 * none. A discarded proposal has no server history at all, so its local trail
 * is all there is — and the sheet says so rather than looking empty.
 *
 * Read-only throughout: no restore, no undo. The log is a record.
 */
export function TransactionHistoryDrawer({
  message,
  kind,
  currency,
  resolveCategoryName,
  resolveWalletName,
  onClose,
}: TransactionHistoryDrawerProps) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const transactionId = kind === "deleted" ? message?.transactionId : undefined;
  const auditLogs = useAuditLogsQuery(transactionId, Boolean(transactionId));

  const serverEntries = useMemo(
    () => auditLogs.data?.pages.flatMap((page) => page.data) ?? [],
    [auditLogs.data],
  );
  // Older changes page in as the sheet nears its end — it used to stop at the first 20.
  const loadOlder = () => {
    if (auditLogs.hasNextPage && !auditLogs.isFetchingNextPage) void auditLogs.fetchNextPage();
  };

  const formatValue = (field: string, value: unknown): string => {
    if (value === null || value === undefined) return "—";
    switch (field) {
      case "amount":
        return formatCurrencyTruncated(Number(value), currency);
      case "category_id":
        return resolveCategoryName(String(value));
      case "wallet_id":
        return resolveWalletName(String(value));
      case "occurred_at":
        return formatDateShort(String(value));
      case "type":
        return t(TYPE_LABEL[String(value)] ?? "common.txType.expenseShort");
      default:
        return String(value);
    }
  };

  const renderServerEntry = (entry: AuditLogEntry) => {
    const changed =
      entry.action === "update" && entry.before && entry.after
        ? Object.keys(entry.after).filter((key) => key in (entry.before ?? {}))
        : [];
    const snapshot = entry.action === "delete" ? entry.before : entry.after;

    return (
      <View key={entry.id} style={styles.entry}>
        <View style={styles.entryHead}>
          <Text style={styles.entryLabel}>{t(ACTION_LABEL[entry.action])}</Text>
          <Text style={styles.entryTime}>
            {formatDateShort(entry.created_at)} · {formatTime(entry.created_at)}
          </Text>
        </View>
        {entry.action === "update" ? (
          changed.map((field) =>
            field === "items" ? (
              <AuditItemsDiff
                key={field}
                logId={entry.id}
                before={(entry.before as Record<string, unknown>)?.[field]}
                after={(entry.after as Record<string, unknown>)?.[field]}
                currency={currency}
              />
            ) : (
              <Text key={field} style={styles.entryDetail} numberOfLines={2}>
                <Text style={styles.fieldLabel}>{field in FIELD_LABEL ? t(FIELD_LABEL[field]) : field}: </Text>
                {formatValue(field, (entry.before as Record<string, unknown>)?.[field])}
                {"  →  "}
                <Text style={styles.newValue}>{formatValue(field, (entry.after as Record<string, unknown>)?.[field])}</Text>
              </Text>
            ),
          )
        ) : (
          <Text style={styles.entryDetail} numberOfLines={2}>
            {snapshot?.amount !== undefined ? formatValue("amount", snapshot.amount) : "—"}
            {snapshot?.category_id ? ` · ${formatValue("category_id", snapshot.category_id)}` : ""}
          </Text>
        )}
      </View>
    );
  };

  const localTrail = message?.editHistory ?? [];

  return (
    <Drawer visible={message !== null} onClose={onClose} onEndReached={kind === "deleted" ? loadOlder : undefined}>
      <View testID="drawer-transaction-history" style={styles.body}>
        <DrawerHeader
          title={t("chat.history.title")}
          actions={[{ label: t("common.action.close"), onPress: onClose, variant: "secondary" }]}
        />

        {kind === "discarded" ? (
          <>
            <Text style={styles.notice}>{t("chat.history.neverSaved")}</Text>
            {localTrail.length === 0 ? (
              <Text style={styles.empty}>{t("chat.history.empty")}</Text>
            ) : (
              [...localTrail].reverse().map((item, index) => (
                <View key={`${item.timestamp}_${index}`} style={styles.entry}>
                  <View style={styles.entryHead}>
                    <Text style={styles.entryLabel}>
                      {item.source === "created"
                        ? t("chat.editHistory.created")
                        : t("chat.editHistory.edit", { number: localTrail.length - 1 - index })}
                    </Text>
                    <Text style={styles.entryTime}>
                      {formatDateShort(new Date(item.timestamp).toISOString())} ·{" "}
                      {formatTime(new Date(item.timestamp).toISOString())}
                    </Text>
                  </View>
                  <Text style={styles.entryDetail} numberOfLines={2}>
                    {proposalAmountSign(item.payload.type)}
                    {formatCurrencyTruncated(item.payload.amount, currency)}
                    {item.payload.note ? ` · ${item.payload.note}` : ""}
                  </Text>
                </View>
              ))
            )}
          </>
        ) : auditLogs.isLoading ? (
          <ActivityIndicator color={colors.green} style={styles.loader} />
        ) : auditLogs.isError ? (
          <View style={styles.errorBlock}>
            <Text style={styles.empty}>{t("chat.history.loadFailed")}</Text>
            <Pressable testID="btn-transaction-history-retry" onPress={() => auditLogs.refetch()}>
              <Text style={styles.retry}>{t("common.action.retry")}</Text>
            </Pressable>
          </View>
        ) : serverEntries.length === 0 ? (
          <Text style={styles.empty}>{t("chat.history.empty")}</Text>
        ) : (
          serverEntries.map(renderServerEntry)
        )}
        {auditLogs.isFetchingNextPage ? <ActivityIndicator color={colors.green} style={styles.loader} /> : null}
      </View>
    </Drawer>
  );
}

const useStyles = createStyles((colors) => ({
  body: { gap: spacing.md },
  notice: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  loader: { marginVertical: spacing.lg },
  errorBlock: { gap: spacing.sm, alignItems: "center" },
  retry: { ...typography.label, color: colors.green },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center" },
  entry: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.listCard,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  entryHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  entryLabel: { ...typography.label, color: colors.textPrimary },
  entryTime: { ...typography.tiny, color: colors.textMuted },
  entryDetail: { ...typography.caption, color: colors.textSecondary },
  fieldLabel: { color: colors.textMuted },
  newValue: { color: colors.textPrimary, fontWeight: "700" },
}));
