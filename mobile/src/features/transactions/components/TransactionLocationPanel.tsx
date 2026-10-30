import { ActivityIndicator, Linking, Pressable, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import { MapPinIcon } from "@/components/ui/Icon";
import { PillButton } from "@/components/ui/PillButton";
import { TRANSACTION_NOTE_MAX_LENGTH } from "@/lib/constants";
import { TranslationKey } from "@/lib/i18n";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { Coordinates, LocationFailure } from "@/features/transactions/location/capture-location";
import { formatCoordinates, openInGoogleMaps } from "@/features/transactions/location/map-support";
import { LocationMap } from "@/features/transactions/components/LocationMap";
import { PlacePick, PlaceSearch } from "@/features/transactions/components/PlaceSearch";
import { SavedPlace } from "@/stores/saved-places-store";

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
  /** Places pinned before, newest first — offered in edit mode. */
  savedPlaces: SavedPlace[];
  onPickPlace: (pick: PlacePick) => void;
  onRemoveSavedPlace: (place: SavedPlace) => void;
}

const FAILURE_COPY: Record<LocationFailure, TranslationKey> = {
  denied: "transactions.location.error.denied",
  services_off: "transactions.location.error.servicesOff",
  unavailable: "transactions.location.error.unavailable",
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
  savedPlaces,
  onPickPlace,
  onRemoveSavedPlace,
}: TransactionLocationPanelProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();

  if (status === "locating") {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.green} />
        <Text style={styles.message}>{t("transactions.location.locating")}</Text>
      </View>
    );
  }

  if (status === "failed" || !coords) {
    return (
      <View style={styles.centered}>
        <MapPinIcon size={32} color={colors.textMuted} />
        <Text style={styles.message}>{t(FAILURE_COPY[failure])}</Text>
        <View style={styles.actions}>
          <PillButton label={t("common.action.retry")} onPress={onRetry} testID="btn-location-retry" />
          {failure === "denied" ? (
            <PillButton label={t("common.action.openSettings")} variant="outline" onPress={() => void Linking.openSettings()} />
          ) : null}
        </View>
      </View>
    );
  }

  const viewing = mode === "view";
  // The same map instance in both modes (same key): switching to edit keeps
  // wherever the User had panned to. A picked place is a new fixId, which
  // remounts it centred there.
  const map = (
    <LocationMap
      key={fixId}
      coords={coords}
      onMove={viewing ? undefined : onMovePin}
      pannable={viewing}
      style={styles.map}
    />
  );
  return (
    <View style={styles.ready}>
      {viewing ? (
        map
      ) : (
        <PlaceSearch savedPlaces={savedPlaces} onPick={onPickPlace} onRemoveSaved={onRemoveSavedPlace}>
          {map}
        </PlaceSearch>
      )}
      <View style={styles.placeRow}>
        <MapPinIcon size={18} color={colors.green} />
        <Text style={styles.placeName} numberOfLines={2} testID="text-location-place">
          {naming ? t("transactions.location.naming") : placeName ?? t("transactions.location.noAreaName")}
        </Text>
      </View>
      {viewing ? (
        <>
          <View style={styles.hintRow}>
            <Text style={styles.hint}>{formatCoordinates(coords)}</Text>
            <Pressable onPress={() => openInGoogleMaps(coords)} hitSlop={8} testID="btn-location-open-maps">
              <Text style={styles.link}>{t("common.action.openInMaps")}</Text>
            </Pressable>
          </View>
          <View style={styles.noteView} testID="text-location-note">
            <Text style={styles.noteLabel}>{t("transactions.location.noteLabel")}</Text>
            <Text style={note ? styles.noteText : styles.noteEmpty}>{note || t("transactions.location.noteEmpty")}</Text>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.hint}>{t("transactions.location.adjustHint", { coords: formatCoordinates(coords) })}</Text>
          <TextInput
            value={note}
            onChangeText={onChangeNote}
            placeholder={t("transactions.location.notePlaceholder")}
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
