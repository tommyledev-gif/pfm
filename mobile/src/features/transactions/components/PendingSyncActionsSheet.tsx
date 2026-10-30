import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PillButton } from "@/components/ui/PillButton";
import { useRequireOnline } from "@/lib/connectivity";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useOutboxStore } from "@/stores/outbox-store";
import { useCurrentUserId } from "@/stores/use-current-user-id";
import { flushOutbox } from "@/features/transactions/outbox/flush-outbox";
import { OutboxItem } from "@/features/transactions/outbox/outbox-types";
import { usePendingSyncUiStore } from "@/features/transactions/outbox/pending-sync-ui-store";
import { pendingItemTitle, pendingStatusText } from "@/features/transactions/components/PendingSyncRow";

interface PendingSyncActionsSheetProps {
  /** Read live from the store by the caller, so a status change shows at once. */
  item: OutboxItem | null;
  onClose: () => void;
}

const DISCARD_COPY = {
  title: "transactions.sync.discard.title",
  message: "transactions.sync.discard.body",
  maybeSent: "transactions.sync.discard.maybeSent",
  confirm: "common.action.discard",
} as const;
const SENDING_HINT = "transactions.sync.sendingHint";
const SCRIM_OPACITY = 0.6;

// Retry / Edit / Discard for one queued Transaction (US-06). Edit and Discard
// are unavailable while it is being sent (S-OFF-50); Discard always confirms
// and warns when an earlier send may have landed (S-OFF-51).
export function PendingSyncActionsSheet({ item, onClose }: PendingSyncActionsSheetProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const userId = useCurrentUserId();
  const startEdit = usePendingSyncUiStore((s) => s.startEdit);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const requireOnline = useRequireOnline();

  const isSending = item?.status === "sending";
  const canRetry = item?.status === "failed";

  const handleRetry = () =>
    requireOnline(() => {
      if (!item || !userId) return;
      useOutboxStore.getState().requeue(userId, item.idempotency_key);
      onClose();
      void flushOutbox("retry");
    });

  const handleEdit = () => {
    if (!item || isSending) return;
    onClose();
    startEdit(item);
  };

  const handleDiscard = () => {
    setConfirmOpen(false);
    // Owner-only: the store is addressed with the signed-in User's own id.
    if (item && userId && item.status !== "sending") useOutboxStore.getState().discard(userId, item.idempotency_key);
    onClose();
  };

  return (
    <>
      <Modal visible={item !== null && !confirmOpen} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable onPress={() => {}} style={styles.card}>
            {item ? (
              <>
                <Text style={styles.title} numberOfLines={2}>
                  {pendingItemTitle(item)}
                </Text>
                <Text style={[styles.status, item.status === "failed" && { color: colors.danger }]}>
                  {isSending ? t(SENDING_HINT) : pendingStatusText(item)}
                </Text>
                {/* One row, as in ConfirmDialog: the way out on the left, the
                    primary action on the right. */}
                <View style={styles.actions}>
                  <PillButton
                    label={t("common.action.discard")}
                    variant="outline"
                    onPress={() => setConfirmOpen(true)}
                    disabled={isSending}
                    singleLine
                    style={styles.flexButton}
                    textStyle={styles.discardLabel}
                    testID="btn-pending-sync-discard"
                  />
                  <PillButton
                    label={t("common.action.edit")}
                    variant={canRetry ? "outline" : "solid"}
                    onPress={handleEdit}
                    disabled={isSending}
                    singleLine
                    style={styles.flexButton}
                    testID="btn-pending-sync-edit"
                  />
                  {canRetry ? (
                    <PillButton
                      label={t("common.action.retry")}
                      onPress={handleRetry}
                      singleLine
                      style={styles.flexButton}
                      testID="btn-pending-sync-retry"
                    />
                  ) : null}
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmDialog
        visible={item !== null && confirmOpen}
        title={t(DISCARD_COPY.title)}
        message={t(item?.maybe_sent ? DISCARD_COPY.maybeSent : DISCARD_COPY.message)}
        confirmLabel={t(DISCARD_COPY.confirm)}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleDiscard}
        testID="dialog-confirm-discard-pending-sync"
      />
    </>
  );
}

// Same chrome as ConfirmDialog, so the two dialogs of this flow read as one.
const CARD_MAX_WIDTH = 340;

const useStyles = createStyles((colors) => ({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: `rgba(0,0,0,${SCRIM_OPACITY})`,
  },
  card: {
    width: "100%",
    maxWidth: CARD_MAX_WIDTH,
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radii.hero,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  title: { ...typography.cardTitle, color: colors.textPrimary },
  status: { ...typography.caption, color: colors.textSecondary },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  // ConfirmDialog's pill: narrower side padding so a label fits a third of the card.
  flexButton: { flex: 1, paddingHorizontal: spacing.md },
  discardLabel: { color: colors.danger },
}));
