import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

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

const SCRIM = "rgba(0,0,0,0.6)";
const CARD_MAX_WIDTH = 340;

/**
 * Sign-out with a non-empty outbox (specs/mobile-offline-support US-07).
 * "Keep" is the safe default, highlighted when offline (EC-OFF-24); "Discard"
 * needs a second confirmation. "Sync now" signs out once the queue is empty,
 * otherwise the dialog stays with the new count (step 3).
 */
export function LogoutGuardDialog({ visible, onCancel, onLogout }: LogoutGuardDialogProps) {
  const { t } = useTranslation();
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
            <Text style={styles.title}>{t("settings.logoutGuard.title", { count })}</Text>
            <Text style={styles.message}>{t("settings.logoutGuard.message")}</Text>
            <View style={styles.actions}>
              {isOnline ? (
                <PillButton label={t("settings.logoutGuard.syncNow")} onPress={handleSyncNow} loading={syncing} testID="btn-logout-sync-now" />
              ) : null}
              <PillButton
                label={t("settings.logoutGuard.keep")}
                variant={isOnline ? "outline" : "solid"}
                onPress={onLogout}
                disabled={syncing}
                testID="btn-logout-keep"
              />
              <PillButton
                label={t("settings.logoutGuard.discard")}
                variant="outline"
                onPress={() => setConfirmDiscard(true)}
                disabled={syncing}
                textStyle={styles.discardLabel}
                testID="btn-logout-discard"
              />
              <PillButton label={t("common.action.cancel")} variant="outline" onPress={onCancel} disabled={syncing} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmDialog
        visible={visible && confirmDiscard}
        title={t("settings.logoutGuard.discardTitle", { count })}
        message={t("settings.logoutGuard.discardMessage")}
        confirmLabel={t("settings.logoutGuard.discardConfirm")}
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
