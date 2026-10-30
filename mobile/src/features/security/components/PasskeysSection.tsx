import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { onlineManager } from "@tanstack/react-query";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ListCell, ListRow, ListSection } from "@/components/ui/grouped-list";
import { PasskeyGlyph, PlusGlyph, TrashGlyph } from "@/components/ui/grouped-list/list-icons";
import { errorText } from "@/lib/api-envelope";
import { formatDateDMY } from "@/lib/format-date";
import { createStyles, spacing, typography, useColors } from "@/lib/theme";
import { useToastStore } from "@/stores/toast-store";
import { useDeletePasskeyMutation, usePasskeysQuery, useRegisterPasskeyMutation } from "@/features/security/api/use-passkeys-query";
import { PasskeyNativeError, passkeysAvailable } from "@/features/security/passkeys/native-passkey";
import { PasskeyItem } from "@/features/security/passkeys/types";
import { copyOf, i18n } from "@/lib/i18n";
import { passkeyFailureMessage } from "@/features/security/passkeys/passkey-messages";
import { PasskeyProviderHelp } from "@/features/security/components/PasskeyProviderHelp";

const COPY = copyOf({
  title: "security.passkeys.title",
  // Optional: switching and the app lock use the phone's own check, never a
  // passkey. A passkey only needs the phone's password service (Google…).
  hint: "security.passkeys.hint",
  add: "security.passkeys.add",
  unsupported: "security.passkeys.unsupported",
  empty: "security.passkeys.empty",
  loadFailed: "security.passkeys.loadFailed",
  added: "security.passkeys.added",
  addFailed: "security.passkeys.addFailed",
  offline: "security.passkeys.offline",
  deleted: "security.passkeys.deleted",
  deleteFailed: "security.passkeys.deleteFailed",
  confirmTitle: "security.passkeys.confirmTitle",
  confirmLabel: "security.passkeys.confirmLabel",
});

const confirmMessage = (device: string) => i18n.t("security.passkeys.confirmMessage", { device });

function usedLine(p: PasskeyItem): string {
  const added = formatDateDMY(p.created_at);
  return p.last_used_at
    ? i18n.t("security.passkeys.addedUsedLine", { added, used: formatDateDMY(p.last_used_at) })
    : i18n.t("security.passkeys.addedLine", { date: added });
}

/**
 * The account's passkeys on the Security screen: what is registered (any
 * phone), adding one on this phone, removing one. Removing works anywhere;
 * adding needs a build with the passkey module (passkeysAvailable).
 * One group: a row per passkey, then "Thêm passkey" as the group's last row.
 */
export function PasskeysSection() {
  useTranslation(); // COPY reads the current language: re-render on a switch
  const colors = useColors();
  const styles = useStyles();
  const available = passkeysAvailable();
  const passkeys = usePasskeysQuery();
  const register = useRegisterPasskeyMutation();
  const remove = useDeletePasskeyMutation();
  const [confirming, setConfirming] = useState<PasskeyItem | null>(null);
  const [needsProvider, setNeedsProvider] = useState(false);
  // The guide was already up and the retry hit the same wall.
  const [providerStillMissing, setProviderStillMissing] = useState(false);
  const toast = useToastStore.getState().show;

  const closeProviderHelp = () => {
    setNeedsProvider(false);
    setProviderStillMissing(false);
  };

  const add = () => {
    if (!onlineManager.isOnline()) {
      toast(COPY.offline, "warning");
      return;
    }
    register.mutate(undefined, {
      onSuccess: () => {
        closeProviderHelp();
        toast(COPY.added, "info");
      },
      onError: (error) => {
        // Nothing on the phone can keep a passkey: a toast cannot fix that,
        // the guide with its settings button can.
        if (error instanceof PasskeyNativeError && error.kind === "no-provider") {
          setProviderStillMissing(needsProvider);
          setNeedsProvider(true);
          return;
        }
        if (error instanceof PasskeyNativeError) {
          const message = passkeyFailureMessage(error.kind, "add");
          if (message) toast(message, "warning");
          return;
        }
        toast(errorText(error, "security.passkeys.addFailed"), "warning");
      },
    });
  };

  const confirmDelete = () => {
    const target = confirming;
    setConfirming(null);
    if (!target) return;
    remove.mutate(target.id, {
      onSuccess: () => toast(COPY.deleted, "info"),
      onError: (error) => toast(errorText(error, "security.passkeys.deleteFailed"), "warning"),
    });
  };

  const list = passkeys.data ?? [];

  return (
    <View style={styles.block}>
      <ListSection header={COPY.title} footer={COPY.hint} testID="section-passkeys">
        {passkeys.isLoading ? (
          <ListCell>
            <ActivityIndicator color={colors.green} />
          </ListCell>
        ) : passkeys.isError ? (
          <ListCell>
            <Text style={styles.note}>{COPY.loadFailed}</Text>
          </ListCell>
        ) : list.length === 0 ? (
          <ListCell>
            <Text style={styles.note}>{COPY.empty}</Text>
          </ListCell>
        ) : (
          list.map((p) => (
            <ListRow
              key={p.id}
              title={p.name}
              titleLines={1}
              subtitle={usedLine(p)}
              icon={PasskeyGlyph}
              tone={colors.lavender}
              trailing={
                <Pressable
                  onPress={() => setConfirming(p)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={i18n.t("security.passkeys.deleteA11y", { device: p.name })}
                  style={({ pressed }) => pressed && styles.pressed}
                  testID="btn-passkey-delete"
                >
                  <TrashGlyph size={20} color={colors.textSecondary} />
                </Pressable>
              }
            />
          ))
        )}
        {/* While the guide below is up, it carries the retry; no second add. */}
        {available && !needsProvider ? (
          <ListRow
            title={COPY.add}
            icon={PlusGlyph}
            tone={colors.green}
            variant="accent"
            chevron={false}
            onPress={add}
            loading={register.isPending}
            testID="btn-passkey-add"
          />
        ) : null}
        {available ? null : (
          <ListCell>
            <Text style={styles.note}>{COPY.unsupported}</Text>
          </ListCell>
        )}
      </ListSection>

      {available && needsProvider ? (
        <PasskeyProviderHelp
          onRetry={add}
          retrying={register.isPending}
          onDismiss={closeProviderHelp}
          stillMissing={providerStillMissing}
        />
      ) : null}

      <ConfirmDialog
        visible={confirming !== null}
        title={COPY.confirmTitle}
        message={confirmMessage(confirming?.name ?? "")}
        confirmLabel={COPY.confirmLabel}
        cancelLabel={i18n.t("common.action.keep")}
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(null)}
        loading={remove.isPending}
        testID="dialog-passkey-delete"
      />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  block: { gap: spacing.md },
  note: { ...typography.caption, fontWeight: "500", color: colors.textSecondary },
  pressed: { opacity: 0.6 },
}));
