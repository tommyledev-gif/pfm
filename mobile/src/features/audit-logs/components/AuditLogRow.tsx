import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { ListCell } from "@/components/ui/grouped-list";
import { formatCurrency } from "@/lib/currency";
import { withAlpha } from "@/lib/color";
import { formatDateShort, formatTime } from "@/lib/format-date";
import { TranslationKey } from "@/lib/i18n";
import { colors, radii, spacing, typography, createStyles } from "@/lib/theme";
import { AuditAction, AuditLogEntry, AuditSnapshot } from "@/features/audit-logs/types";
import { formatCoordinates } from "@/features/transactions/location/map-support";
import { AuditItemsDiff } from "@/features/audit-logs/components/AuditItemsDiff";

const ACTION_LABEL: Record<AuditAction, TranslationKey> = {
  create: "auditLogs.action.create",
  update: "auditLogs.action.update",
  delete: "auditLogs.action.delete",
};

// Getters, not values: read at render time so they follow a theme switch
// (see src/theme/active-palette.ts).
const ACTION_COLOR: Record<AuditAction, string> = {
  get create() { return colors.green; },
  get update() { return colors.mustard; },
  get delete() { return colors.peach; },
};

const FIELD_LABEL: Record<string, TranslationKey> = {
  amount: "common.field.amount",
  category_id: "common.field.category",
  occurred_at: "common.field.date",
  note: "common.field.note",
  wallet_id: "common.field.wallet",
  type: "common.field.type",
  location: "common.field.location",
  location_note: "auditLogs.field.locationNote",
};

// A moved pin is logged as {latitude, longitude, place_name}: read as its
// area's name, or its coordinates when it has none.
function formatPin(value: object): string {
  const pin = value as { latitude?: unknown; longitude?: unknown; place_name?: unknown };
  if (typeof pin.place_name === "string" && pin.place_name) return pin.place_name;
  if (typeof pin.latitude === "number" && typeof pin.longitude === "number") {
    return formatCoordinates({ latitude: pin.latitude, longitude: pin.longitude });
  }
  return "—";
}

interface AuditLogRowProps {
  entry: AuditLogEntry;
  // Resolved by the screen from its own categories/wallets caches, so a
  // category or wallet that has since been renamed (or soft-deleted) still
  // renders a name rather than a bare UUID — the audit entry itself only
  // ever stores ids (spec.md US-02 Edge Cases #1).
  resolveCategoryName: (id: string) => string;
  resolveWalletName: (id: string) => string;
  currency: string;
}

// One line per changed field, e.g. "Số tiền: 200.000 ₫ → 300.000 ₫". For a
// create/delete (a full snapshot rather than a diff) it renders the snapshot
// as a compact summary line instead of a list of arrows. A cell of its day's
// group (GroupedListCell), so entries are split by hairlines, not boxed.
export function AuditLogRow({ entry, resolveCategoryName, resolveWalletName, currency }: AuditLogRowProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const formatValue = (field: string, value: unknown): string => {
    if (value === null || value === undefined) return "—";
    switch (field) {
      case "amount":
        return formatCurrency(Number(value), currency);
      case "category_id":
        return resolveCategoryName(String(value));
      case "wallet_id":
        return resolveWalletName(String(value));
      case "occurred_at":
        return formatDateShort(String(value));
      case "type":
        return value === "income" ? "Thu" : "Chi";
      case "location":
        return typeof value === "object" ? formatPin(value) : String(value);
      default:
        return String(value);
    }
  };

  const snapshotSummary = (snapshot: AuditSnapshot): string => {
    const parts: string[] = [];
    if (snapshot.amount !== undefined) parts.push(formatValue("amount", snapshot.amount));
    if (snapshot.category_id) parts.push(formatValue("category_id", snapshot.category_id));
    if (snapshot.wallet_id) parts.push(formatValue("wallet_id", snapshot.wallet_id));
    return parts.join(" · ");
  };

  const changedFields =
    entry.action === "update" && entry.before && entry.after
      ? Object.keys(entry.after).filter((key) => key in (entry.before ?? {}))
      : [];

  const snapshot = entry.action === "delete" ? entry.before : entry.after;

  return (
    <ListCell style={styles.row}>
      <View style={styles.headerRow}>
        <View style={[styles.actionBadge, { backgroundColor: withAlpha(ACTION_COLOR[entry.action], 0.14) }]}>
          <Text style={[styles.actionLabel, { color: ACTION_COLOR[entry.action] }]}>
            {t(ACTION_LABEL[entry.action])}
          </Text>
        </View>
        <Text style={styles.time}>{formatTime(entry.created_at)}</Text>
      </View>

      {entry.action === "update" ? (
        <View style={styles.changeList}>
          {changedFields.length === 0 ? (
            <Text style={styles.changeLine}>{t("auditLogs.row.noChanges")}</Text>
          ) : (
            changedFields.map((field) =>
              field === "items" ? (
                <AuditItemsDiff
                  key={field}
                  logId={entry.id}
                  before={(entry.before as Record<string, unknown>)?.[field]}
                  after={(entry.after as Record<string, unknown>)?.[field]}
                  currency={currency}
                />
              ) : (
                <Text key={field} style={styles.changeLine} numberOfLines={2}>
                  <Text style={styles.fieldLabel}>{FIELD_LABEL[field] ? t(FIELD_LABEL[field]) : field}: </Text>
                  {formatValue(field, (entry.before as Record<string, unknown>)?.[field])}
                  {"  →  "}
                  <Text style={styles.newValue}>
                    {formatValue(field, (entry.after as Record<string, unknown>)?.[field])}
                  </Text>
                </Text>
              ),
            )
          )}
        </View>
      ) : (
        <>
          <Text style={styles.changeLine} numberOfLines={2}>
            {snapshot ? snapshotSummary(snapshot) : "—"}
          </Text>
          {/* A removal is the one entry people come here to find, so it says
              when it happened in words rather than leaving the reader to infer
              it from the day header and the trailing time. */}
          {entry.action === "delete" ? (
            <Text style={styles.removedNote} numberOfLines={1}>
              {t("auditLogs.row.deletedAt", { time: formatTime(entry.created_at), date: formatDateShort(entry.created_at) })}
            </Text>
          ) : null}
        </>
      )}
    </ListCell>
  );
}

const useStyles = createStyles((colors) => ({
  row: { gap: spacing.sm },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  actionBadge: { paddingVertical: 2, paddingHorizontal: spacing.sm, borderRadius: radii.pill },
  actionLabel: { ...typography.tiny, fontWeight: "700" },
  time: { ...typography.tiny, color: colors.textMuted },
  changeList: { gap: 2 },
  changeLine: { ...typography.caption, color: colors.textSecondary },
  removedNote: { ...typography.tiny, color: colors.peach },
  fieldLabel: { color: colors.textMuted },
  newValue: { color: colors.textPrimary, fontWeight: "700" },
}));
