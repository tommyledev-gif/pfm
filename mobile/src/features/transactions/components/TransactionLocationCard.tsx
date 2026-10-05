import { Text, TextInput, View } from "react-native";

import { MapPinIcon } from "@/components/ui/Icon";
import { TRANSACTION_NOTE_MAX_LENGTH } from "@/lib/constants";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { TransactionLocation } from "@/features/transactions/types";
import { LocationMap } from "@/features/transactions/components/LocationMap";

interface TransactionLocationCardProps {
  location: TransactionLocation;
  note: string;
  onChangeNote: (note: string) => void;
}

const PREVIEW_HEIGHT = 140;

// Where a saved Transaction was pinned, on its edit form. The pin itself is
// fixed once created; its note is the one part that can still change. A tap
// on the map opens the spot in Google Maps.
export function TransactionLocationCard({ location, note, onChangeNote }: TransactionLocationCardProps) {
  const colors = useColors();
  const styles = useStyles();

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Vị trí</Text>
      <LocationMap coords={location} style={styles.map} />
      <View style={styles.placeRow}>
        <MapPinIcon size={16} color={colors.green} />
        <Text style={styles.placeName} numberOfLines={2}>
          {location.place_name ?? "Chưa có tên khu vực"}
        </Text>
      </View>
      <TextInput
        value={note}
        onChangeText={onChangeNote}
        placeholder="Ghi chú về địa điểm: đường đi, cổng, tầng…"
        placeholderTextColor={colors.textMuted}
        style={styles.noteInput}
        multiline
        maxLength={TRANSACTION_NOTE_MAX_LENGTH}
        testID="input-transaction-location-note"
      />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  card: { gap: spacing.sm },
  label: { ...typography.caption, color: colors.textSecondary },
  map: { height: PREVIEW_HEIGHT },
  placeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  placeName: { flex: 1, ...typography.label, color: colors.textPrimary },
  noteInput: {
    minHeight: 48,
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
