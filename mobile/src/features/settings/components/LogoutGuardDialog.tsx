import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PillButton } from "@/components/ui/PillButton";
import { useIsOnline } from "@/lib/connectivity";
import { radii, spacing, typography, createStyles } from "@/lib/theme";
import { useOutboxCount, useOutboxStore } from "@/stores/outbox-store";
import { useCurrentUserId } from "@/stores/use-current-user-id";
import { flushOutbox } from "@/features/transactions/outbox/flush-outbox";

interface LogoutGuardDialogProps {
  visible: boolean;
  onCancel: () => void;
  /** The ordinary logout (use-logout.ts) — run once the User has chosen. */
  onLogout: () => void;
}

const COPY = {
  title: (n: number) => `Còn ${n} giao dịch chưa đồng bộ`,
  message: "Giữ lại: giao dịch được lưu trên máy này và tự đồng bộ khi bạn đăng nhập lại.",
  syncNow: "Đồng bộ ngay",
  keep: "Giữ lại và đăng xuất",
  discard: "Bỏ và đăng xuất",
  cancel: "Huỷ",
  discardTitle: (n: number) => `Bỏ ${n} giao dịch và đăng xuất?`,
  discardMessage: "Các giao dịch này sẽ bị xoá khỏi máy và không bao giờ được gửi lên tài khoản.",
  discardConfirm: "Bỏ",
} as const;
const SCRIM = "rgba(0,0,0,0.6)";
const CARD_MAX_WIDTH = 340;

/**
 * Sign-out with a non-empty outbox (specs/mobile-offline-support US-07).
 * "Keep" is the safe default, highlighted when offline (EC-OFF-24); "Discard"
 * needs a second confirmation. "Sync now" signs out once the queue is empty,
 * otherwise the dialog stays with the new count (step 3).
 */
export function LogoutGuardDialog({ visible, onCancel, onLogout }: LogoutGuardDialogProps) {
  const styles = useStyles();
  const userId = useCurrentUserId();
  const isOnline = useIsOnline();
  const count = useOutboxCount(userId);
  const [syncing, setSyncing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await flushOutbox("logout");
    } finally {
      setSyncing(false);
    }
    if (userId && (useOutboxStore.getState().byUser[userId]?.length ?? 0) === 0) onLogout();
  };

  const handleDiscard = () => {
    setConfirmDiscard(false);
    // Only the signed-in owner's own queue — the one explicit way it goes.
    if (userId) useOutboxStore.getState().discardAllFor(userId);
    onLogout();
  };

  return (
    <>
      <Modal visible={visible && !confirmDiscard} transparent animationType="fade" onRequestClose={onCancel}>
        <Pressable style={styles.backdrop} onPress={syncing ? undefined : onCancel}>
          <Pressable onPress={() => {}} style={styles.card} testID="dialog-logout-unsynced">
            <Text style={styles.title}>{COPY.title(count)}</Text>
            <Text style={styles.message}>{COPY.message}</Text>
            <View style={styles.actions}>
              {isOnline ? (
                <PillButton label={COPY.syncNow} onPress={handleSyncNow} loading={syncing} testID="btn-logout-sync-now" />
              ) : null}
              <PillButton
                label={COPY.keep}
                variant={isOnline ? "outline" : "solid"}
                onPress={onLogout}
                disabled={syncing}
                testID="btn-logout-keep"
              />
              <PillButton
                label={COPY.discard}
                variant="outline"
                onPress={() => setConfirmDiscard(true)}
                disabled={syncing}
                textStyle={styles.discardLabel}
                testID="btn-logout-discard"
              />
              <PillButton label={COPY.cancel} variant="outline" onPress={onCancel} disabled={syncing} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmDialog
        visible={visible && confirmDiscard}
        title={COPY.discardTitle(count)}
        message={COPY.discardMessage}
        confirmLabel={COPY.discardConfirm}
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={handleDiscard}
      />
    </>
  );
}

const useStyles = createStyles((colors) => ({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, backgroundColor: SCRIM },
  card: {
    width: "100%",
    maxWidth: CARD_MAX_WIDTH,
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radii.hero,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  title: { ...typography.title, color: colors.textPrimary },
  message: { ...typography.body, color: colors.textSecondary },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  discardLabel: { color: colors.danger },
}));
