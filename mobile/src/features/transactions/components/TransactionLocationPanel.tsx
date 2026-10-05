import { ActivityIndicator, Linking, Text, TextInput, View } from "react-native";

import { MapPinIcon } from "@/components/ui/Icon";
import { PillButton } from "@/components/ui/PillButton";
import { TRANSACTION_NOTE_MAX_LENGTH } from "@/lib/constants";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { Coordinates, LocationFailure } from "@/features/transactions/location/capture-location";
import { formatCoordinates } from "@/features/transactions/location/map-support";
import { LocationMap } from "@/features/transactions/components/LocationMap";

export type LocationStepStatus = "locating" | "ready" | "failed";

interface TransactionLocationPanelProps {
  status: LocationStepStatus;
  failure: LocationFailure;
  coords: Coordinates | null;
  // Remount key for the map — a new fix recentres it, a moved pin does not.
  fixId: number;
  placeName: string | null;
  naming: boolean;
  note: string;
  onChangeNote: (note: string) => void;
  onMovePin: (coords: Coordinates) => void;
  onRetry: () => void;
}

const FAILURE_COPY: Record<LocationFailure, string> = {
  denied: "Budgest chưa được cấp quyền vị trí. Hãy cho phép trong Cài đặt rồi thử lại.",
  services_off: "Định vị (GPS) đang tắt. Bật định vị để ghim vị trí giao dịch.",
  unavailable: "Chưa lấy được vị trí hiện tại. Thử lại ở nơi thoáng hơn.",
};

// Body of the "Ghim vị trí" step (use-location-step.tsx owns its state).
export function TransactionLocationPanel({
  status,
  failure,
  coords,
  fixId,
  placeName,
  naming,
  note,
  onChangeNote,
  onMovePin,
  onRetry,
}: TransactionLocationPanelProps) {
  const colors = useColors();
  const styles = useStyles();

  if (status === "locating") {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.green} />
        <Text style={styles.message}>Đang xác định vị trí…</Text>
      </View>
    );
  }

  if (status === "failed" || !coords) {
    return (
      <View style={styles.centered}>
        <MapPinIcon size={32} color={colors.textMuted} />
        <Text style={styles.message}>{FAILURE_COPY[failure]}</Text>
        <View style={styles.actions}>
          <PillButton label="Thử lại" onPress={onRetry} testID="btn-location-retry" />
          {failure === "denied" ? (
            <PillButton label="Mở Cài đặt" variant="outline" onPress={() => void Linking.openSettings()} />
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.ready}>
      <LocationMap key={fixId} coords={coords} onMove={onMovePin} style={styles.map} />
      <View style={styles.placeRow}>
        <MapPinIcon size={18} color={colors.green} />
        <Text style={styles.placeName} numberOfLines={2} testID="text-location-place">
          {naming ? "Đang tìm khu vực…" : placeName ?? "Chưa có tên khu vực (cần mạng) — vẫn lưu toạ độ"}
        </Text>
      </View>
      <Text style={styles.hint}>{formatCoordinates(coords)} · Chạm hoặc kéo ghim để chỉnh lại</Text>
      <TextInput
        value={note}
        onChangeText={onChangeNote}
        placeholder="Ghi chú về địa điểm: đường đi, cổng, tầng… (không bắt buộc)"
        placeholderTextColor={colors.textMuted}
        style={styles.noteInput}
        multiline
        maxLength={TRANSACTION_NOTE_MAX_LENGTH}
        testID="input-location-note"
      />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  message: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
  actions: { flexDirection: "row", gap: spacing.sm },
  ready: { flex: 1, gap: spacing.sm, paddingBottom: spacing.md },
  map: { flex: 1 },
  placeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  placeName: { flex: 1, ...typography.body, color: colors.textPrimary },
  hint: { ...typography.tiny, color: colors.textMuted },
  noteInput: {
    minHeight: 64,
    maxHeight: 120,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.listCard,
    backgroundColor: colors.surfaceRaised,
    color: colors.textPrimary,
    textAlignVertical: "top",
    ...typography.body,
  },
}));
