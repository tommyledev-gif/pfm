import { ReactNode } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";

import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { CheckIcon, LockIcon } from "@/components/ui/Icon";
import { PillButton } from "@/components/ui/PillButton";
import { formatDateDMY, formatTime } from "@/lib/format-date";
import { currentLanguage } from "@/lib/i18n";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";

// The "last updated" time stands for the whole saved snapshot; Wallets are
// what every main screen leads with, so their fetch time is the reference.
const LAST_UPDATED_QUERY_KEY = ["wallets"] as const;

// What still works offline, and what does not — the online-only list is
// specs/mobile-offline-support S-OFF-11 (decision #2), in the User's words.
const STILL_WORKS = ["ui.offline.sheet.stillWorks.viewSaved", "ui.offline.sheet.stillWorks.addTransaction"] as const;
const NEEDS_NETWORK = [
  "ui.offline.sheet.needsNetwork.editDelete",
  "ui.offline.sheet.needsNetwork.manage",
  "ui.offline.sheet.needsNetwork.assistant",
  "ui.offline.sheet.needsNetwork.importExport",
  "ui.offline.sheet.needsNetwork.inviteMembers",
] as const;

interface OfflineInfoSheetProps {
  visible: boolean;
  onClose: () => void;
  queuedCount: number;
}

/**
 * Opened from the offline strip: how old the data on screen is, and what can
 * and cannot be done until the network is back. The time lives here rather
 * than on the strip — on a screen with no data it meant nothing, and the
 * strip has to stay one short phrase.
 */
export function OfflineInfoSheet({ visible, onClose, queuedCount }: OfflineInfoSheetProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const queryClient = useQueryClient();
  // Read at render, not subscribed: the sheet is a snapshot, and the saved
  // data cannot change while offline anyway.
  const lastUpdatedMs = Math.max(
    0,
    ...queryClient.getQueryCache().findAll({ queryKey: LAST_UPDATED_QUERY_KEY }).map((q) => q.state.dataUpdatedAt),
  );

  return (
    <Drawer
      visible={visible}
      onClose={onClose}
      footer={<PillButton label={t("common.action.gotIt")} onPress={onClose} testID="btn-offline-info-close" />}
    >
      <DrawerHeader title={t("ui.offline.sheet.title")} />
      <View style={styles.summary} testID="sheet-offline-info">
        <Text style={styles.updated}>
          {lastUpdatedMs > 0
            ? t("ui.offline.sheet.lastUpdated", { time: formatLastUpdated(lastUpdatedMs) })
            : t("ui.offline.sheet.noSavedData")}
        </Text>
        <Text style={styles.caption}>{t("ui.offline.sheet.staleNote")}</Text>
        {queuedCount > 0 ? (
          <Text style={styles.queued}>{t("ui.offline.sheet.queued", { count: queuedCount })}</Text>
        ) : null}
      </View>

      <Section title={t("ui.offline.sheet.stillWorksTitle")}>
        {STILL_WORKS.map((key) => (
          <Row key={key} icon={<CheckIcon size={14} color={colors.green} strokeWidth={2.4} />} text={t(key)} />
        ))}
      </Section>
      <Section title={t("ui.offline.sheet.needsNetworkTitle")}>
        {NEEDS_NETWORK.map((key) => (
          <Row key={key} icon={<LockIcon size={14} color={colors.textMuted} />} text={t(key)} />
        ))}
      </Section>
    </Drawer>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ icon, text }: { icon: ReactNode; text: string }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      {icon}
      <Text style={styles.rowText}>{text}</Text>
    </View>
  );
}

// "HH:mm" when the data is from today, "dd/MM HH:mm" otherwise — an older
// snapshot must not read as if it were from this morning. English takes the
// full "Oct 29, 2026": a bare "29/10" reads as month/day there.
function formatLastUpdated(ms: number): string {
  const date = new Date(ms);
  const iso = date.toISOString();
  if (date.toDateString() === new Date().toDateString()) return formatTime(iso);
  if (currentLanguage() === "en") return `${formatDateDMY(iso)} ${formatTime(iso)}`;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month} ${formatTime(iso)}`;
}

const useStyles = createStyles((colors) => ({
  summary: { gap: spacing.xs },
  updated: { ...typography.body, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary },
  queued: { ...typography.caption, color: colors.textPrimary, marginTop: spacing.xs },
  section: { gap: spacing.sm, marginTop: spacing.sm },
  sectionTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowText: { ...typography.label, color: colors.textPrimary, flexShrink: 1 },
}));
