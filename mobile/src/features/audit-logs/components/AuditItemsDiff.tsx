import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { formatCurrency } from "@/lib/currency";
import { TranslationKey } from "@/lib/i18n";
import { createStyles, spacing, typography } from "@/lib/theme";

// The `items` value of an update entry (backend auditLinesSummary,
// specs/transaction-line-items AC-24): count + Items total, and the full lists
// so a removed line stays readable.
interface AuditLines {
  count?: number;
  items_total?: number;
  items?: { name?: string; quantity?: number; amount?: number }[];
  adjustments?: { kind?: string; direction?: string; label?: string | null; amount?: number }[];
}

interface AuditItemsDiffProps {
  logId: string;
  before: unknown;
  after: unknown;
  currency: string;
}

const KIND_LABEL: Record<string, TranslationKey> = {
  tax: "common.adjustment.tax",
  fee: "common.adjustment.fee",
  discount: "common.adjustment.discount",
  other: "common.adjustment.other",
};

function asLines(value: unknown): AuditLines {
  return typeof value === "object" && value !== null ? (value as AuditLines) : {};
}

export function AuditItemsDiff({ logId, before, after, currency }: AuditItemsDiffProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const [expanded, setExpanded] = useState(false);
  const from = asLines(before);
  const to = asLines(after);
  const summary = (lines: AuditLines) =>
    t("auditLogs.items.summary", { count: lines.count ?? 0, amount: formatCurrency(lines.items_total ?? 0, currency) });

  return (
    <View testID={`audit-items-diff-${logId}`}>
      <Text style={styles.line} numberOfLines={2}>
        <Text style={styles.label}>{t("auditLogs.items.label")}: </Text>
        {summary(from)}
        {"  →  "}
        <Text style={styles.newValue}>{summary(to)}</Text>
      </Text>
      <Pressable accessibilityRole="button" onPress={() => setExpanded((v) => !v)}>
        <Text style={styles.toggle}>{t(expanded ? "auditLogs.items.hide" : "auditLogs.items.show")}</Text>
      </Pressable>
      {expanded ? (
        <View style={styles.lists}>
          <LineList title={t("auditLogs.items.before")} lines={from} currency={currency} />
          <LineList title={t("auditLogs.items.after")} lines={to} currency={currency} />
        </View>
      ) : null}
    </View>
  );
}

function LineList({ title, lines, currency }: { title: string; lines: AuditLines; currency: string }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const items = lines.items ?? [];
  const adjustments = lines.adjustments ?? [];
  return (
    <View style={styles.list}>
      <Text style={styles.label}>{title}</Text>
      {items.length === 0 ? <Text style={styles.line}>{t("auditLogs.items.none")}</Text> : null}
      {items.map((item, index) => (
        <Text key={`i-${index}`} style={styles.line} numberOfLines={1}>
          {item.name}
          {(item.quantity ?? 1) > 1 ? ` × ${item.quantity}` : ""} · {formatCurrency(item.amount ?? 0, currency)}
        </Text>
      ))}
      {adjustments.map((a, index) => (
        <Text key={`a-${index}`} style={styles.line} numberOfLines={1}>
          {a.kind === "other" ? a.label : (KIND_LABEL[a.kind ?? ""] ? t(KIND_LABEL[a.kind ?? ""]) : "")} · {a.direction === "subtract" ? "−" : "+"}
          {formatCurrency(a.amount ?? 0, currency)}
        </Text>
      ))}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  line: { ...typography.caption, color: colors.textSecondary },
  label: { color: colors.textMuted },
  newValue: { color: colors.textPrimary, fontWeight: "700" },
  toggle: { ...typography.tiny, color: colors.green, marginTop: spacing.xs },
  lists: { gap: spacing.sm, marginTop: spacing.xs },
  list: { gap: 2 },
}));
