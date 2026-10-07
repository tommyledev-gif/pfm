import { ActivityIndicator, Linking, Pressable, Text, TextInput, View } from "react-native";

import { MapPinIcon } from "@/components/ui/Icon";
import { PillButton } from "@/components/ui/PillButton";
import { TRANSACTION_NOTE_MAX_LENGTH } from "@/lib/constants";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { Coordinates, LocationFailure } from "@/features/transactions/location/capture-location";
import { formatCoordinates, openInGoogleMaps } from "@/features/transactions/location/map-support";
import { LocationMap } from "@/features/transactions/components/LocationMap";

export type LocationStepStatus = "locating" | "ready" | "failed";
// "view": a pin that already exists — look around, nothing moves until the
// User asks to edit. "edit": the pin follows taps and drags, the note is open.
export type LocationStepMode = "view" | "edit";

interface TransactionLocationPanelProps {
  status: LocationStepStatus;
  mode: LocationStepMode;
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
  mode,
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

  const viewing = mode === "view";
  return (
    <View style={styles.ready}>
      {/* The same map instance in both modes (same key): switching to edit
          keeps wherever the User had panned to. */}
      <LocationMap
        key={fixId}
        coords={coords}
        onMove={viewing ? undefined : onMovePin}
        pannable={viewing}
        style={styles.map}
      />
      <View style={styles.placeRow}>
        <MapPinIcon size={18} color={colors.green} />
        <Text style={styles.placeName} numberOfLines={2} testID="text-location-place">
          {naming ? "Đang tìm khu vực…" : placeName ?? "Chưa có tên khu vực (cần mạng) — vẫn lưu toạ độ"}
        </Text>
      </View>
      {viewing ? (
        <>
          <View style={styles.hintRow}>
            <Text style={styles.hint}>{formatCoordinates(coords)}</Text>
            <Pressable onPress={() => openInGoogleMaps(coords)} hitSlop={8} testID="btn-location-open-maps">
              <Text style={styles.link}>Mở trên Google Maps</Text>
            </Pressable>
          </View>
          <View style={styles.noteView} testID="text-location-note">
            <Text style={styles.noteLabel}>Ghi chú địa điểm</Text>
            <Text style={note ? styles.noteText : styles.noteEmpty}>{note || "Chưa có ghi chú cho địa điểm này."}</Text>
          </View>
        </>
      ) : (
        <>
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
        </>
      )}
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
  hintRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  link: { ...typography.tiny, color: colors.green },
  noteView: {
    gap: 2,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.listCard,
    backgroundColor: colors.surfaceRaised,
  },
  noteLabel: { ...typography.tiny, color: colors.textSecondary },
  noteText: { ...typography.body, color: colors.textPrimary },
  noteEmpty: { ...typography.body, color: colors.textMuted },
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
