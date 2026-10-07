import { Pressable, Text, View } from "react-native";

import { ChevronRightIcon, MapPinIcon } from "@/components/ui/Icon";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { TransactionLocation } from "@/features/transactions/types";
import { LocationMap } from "@/features/transactions/components/LocationMap";

interface TransactionLocationCardProps {
  /** The pin as this sheet has it — a move or note edit not yet saved included. */
  location: TransactionLocation;
  /** The pin was moved in this sheet and is waiting for the form's save. */
  moved: boolean;
  /** Opens the full map ("Vị trí giao dịch") — to look, and from there to edit. */
  onPress: () => void;
}

// Tall enough to read the streets around the pin; the full map is one tap away.
const PREVIEW_HEIGHT = 180;

// Where a saved Transaction was pinned, on its edit form: a still preview of
// the map, the area's name and the User's note about the place. The whole
// card opens the location step in view mode — the full map to pan around,
// with a "Sửa vị trí" button there to move the pin or change the note.
//
// ⚠️ It used to be a 140px preview whose only tap went out to Google Maps, with
// the note as an always-open text field — the map was cropped to a sliver and
// there was no way to look at the spot in the app at all.
export function TransactionLocationCard({ location, moved, onPress }: TransactionLocationCardProps) {
  const colors = useColors();
  const styles = useStyles();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>Vị trí</Text>
        <Pressable onPress={onPress} hitSlop={8} style={styles.headerAction}>
          <Text style={styles.headerActionLabel}>Xem bản đồ</Text>
          <ChevronRightIcon size={14} color={colors.green} />
        </Pressable>
      </View>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Vị trí: ${location.place_name ?? "chưa có tên khu vực"}. Mở bản đồ`}
        testID="btn-transaction-location"
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
      >
        {/* Taps go to the card, not into the still map underneath. */}
        <View pointerEvents="none">
          <LocationMap coords={location} style={styles.map} />
        </View>
        <View style={styles.details}>
          <View style={styles.placeRow}>
            <MapPinIcon size={16} color={colors.green} />
            <Text style={styles.placeName} numberOfLines={2}>
              {location.place_name ?? "Chưa có tên khu vực"}
            </Text>
          </View>
          <Text style={location.note ? styles.note : styles.noteEmpty} numberOfLines={3} testID="text-transaction-location-note">
            {location.note || "Chưa có ghi chú cho địa điểm này."}
          </Text>
          {moved ? (
            <View style={styles.movedPill}>
              <Text style={styles.movedLabel} numberOfLines={1}>
                Đã dời ghim — nhấn Lưu để cập nhật.
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  card: { gap: spacing.sm },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { ...typography.caption, color: colors.textSecondary },
  headerAction: { flexDirection: "row", alignItems: "center", gap: 2 },
  headerActionLabel: { ...typography.caption, color: colors.green },
  body: {
    borderRadius: radii.listCard,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surfaceRaised,
    overflow: "hidden",
  },
  pressed: { opacity: 0.85 },
  // Square bottom corners: the map runs into the details below it.
  map: { height: PREVIEW_HEIGHT, borderRadius: 0 },
  details: { gap: spacing.xs, padding: spacing.md },
  placeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  placeName: { flex: 1, ...typography.label, color: colors.textPrimary },
  note: { ...typography.caption, fontWeight: "500", color: colors.textSecondary },
  noteEmpty: { ...typography.caption, fontWeight: "500", color: colors.textMuted },
  // A View pill, not padding on the Text — Android measures a padded Text
  // too narrow and wraps or clips it.
  movedPill: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: withAlpha(colors.mustard, 0.1),
  },
  movedLabel: { ...typography.tiny, color: colors.mustard },
}));
