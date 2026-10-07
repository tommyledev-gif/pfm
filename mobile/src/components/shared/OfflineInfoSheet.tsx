import { ReactNode } from "react";
import { Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { CheckIcon, LockIcon } from "@/components/ui/Icon";
import { PillButton } from "@/components/ui/PillButton";
import { formatTime } from "@/lib/format-date";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";

// The "last updated" time stands for the whole saved snapshot; Wallets are
// what every main screen leads with, so their fetch time is the reference.
const LAST_UPDATED_QUERY_KEY = ["wallets"] as const;

// What still works offline, and what does not — the online-only list is
// specs/mobile-offline-support S-OFF-11 (decision #2), in the User's words.
const STILL_WORKS = ["Xem dữ liệu đã lưu", "Thêm giao dịch mới — tự đồng bộ khi có mạng"];
const NEEDS_NETWORK = [
  "Sửa hoặc xoá giao dịch",
  "Thêm, sửa ví, danh mục, ngân sách",
  "Trò chuyện với AI và duyệt đề xuất",
  "Nhập, xuất dữ liệu",
  "Mời thành viên",
];

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
      footer={<PillButton label="Đã hiểu" onPress={onClose} testID="btn-offline-info-close" />}
    >
      <DrawerHeader title="Đang ngoại tuyến" />
      <View style={styles.summary} testID="sheet-offline-info">
        <Text style={styles.updated}>
          {lastUpdatedMs > 0
            ? `Dữ liệu cập nhật lúc ${formatLastUpdated(lastUpdatedMs)}`
            : "Chưa có dữ liệu nào được lưu trên máy"}
        </Text>
        <Text style={styles.caption}>Số dư và số liệu có thể đã cũ cho tới khi có mạng lại.</Text>
        {queuedCount > 0 ? (
          <Text style={styles.queued}>{queuedCount} giao dịch đang chờ — sẽ tự đồng bộ khi có mạng.</Text>
        ) : null}
      </View>

      <Section title="Vẫn làm được">
        {STILL_WORKS.map((text) => (
          <Row key={text} icon={<CheckIcon size={14} color={colors.green} strokeWidth={2.4} />} text={text} />
        ))}
      </Section>
      <Section title="Cần kết nối mạng">
        {NEEDS_NETWORK.map((text) => (
          <Row key={text} icon={<LockIcon size={14} color={colors.textMuted} />} text={text} />
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
// snapshot must not read as if it were from this morning.
function formatLastUpdated(ms: number): string {
  const date = new Date(ms);
  const iso = date.toISOString();
  if (date.toDateString() === new Date().toDateString()) return formatTime(iso);
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
