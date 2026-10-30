import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { spacing, typography, createStyles } from "@/lib/theme";
import { useOutboxItems } from "@/stores/outbox-store";
import { useCurrentUserId } from "@/stores/use-current-user-id";
import { PendingSyncRow } from "@/features/transactions/components/PendingSyncRow";
import { PendingSyncActionsSheet } from "@/features/transactions/components/PendingSyncActionsSheet";

/**
 * "Waiting to sync" above the server list (specs/mobile-offline-support
 * US-06): the signed-in User's queue, newest first, whatever filters are
 * active. Local data, so it shows at once even offline (S-OFF-53); absent
 * when the queue is empty (S-OFF-52).
 */
export function PendingSyncSection() {
  const { t } = useTranslation();
  const styles = useStyles();
  const userId = useCurrentUserId();
  const items = useOutboxItems(userId);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const newestFirst = useMemo(() => [...items].sort((a, b) => b.enqueued_at.localeCompare(a.enqueued_at)), [items]);
  // Looked up live, so the sheet follows the item's state while it is open.
  const selected = items.find((i) => i.idempotency_key === selectedKey) ?? null;

  if (items.length === 0) return null;

  return (
    <View style={styles.section} testID="section-pending-sync">
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t("common.status.pendingSync")}</Text>
        <Text style={styles.count}>{items.length}</Text>
      </View>
      {newestFirst.map((item, index) => (
        <PendingSyncRow
          key={item.idempotency_key}
          item={item}
          isLast={index === newestFirst.length - 1}
          onPress={() => setSelectedKey(item.idempotency_key)}
        />
      ))}
      <PendingSyncActionsSheet item={selected} onClose={() => setSelectedKey(null)} />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  section: { marginBottom: spacing.sm },
  headerRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  title: { ...typography.label, color: colors.textPrimary },
  count: { ...typography.caption, color: colors.textMuted },
}));
