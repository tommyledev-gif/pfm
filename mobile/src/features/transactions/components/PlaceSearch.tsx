import { ReactNode, useMemo, useState } from "react";
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import { EdgeFade } from "@/components/ui/EdgeFade";
import { CloseIcon, HistoryIcon, MapPinIcon, SearchIcon } from "@/components/ui/Icon";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { SavedPlace } from "@/stores/saved-places-store";
import { Coordinates } from "@/features/transactions/location/capture-location";
import {
  MIN_PLACE_QUERY_LENGTH,
  filterSavedPlaces,
  savedPlaceLabel,
  usePlaceSearch,
} from "@/features/transactions/location/use-place-search";

const HIT_SLOP = 10;
const CHIP_FADE_WIDTH = 24;
// The chip row is a shortcut, not the list: the rest are one tap away in search.
const MAX_CHIPS = 8;

export interface PlacePick {
  coords: Coordinates;
  placeName: string | null;
  /** A saved place's own note, offered for the new pin. */
  note?: string;
}

interface PlaceSearchProps {
  savedPlaces: SavedPlace[];
  onPick: (pick: PlacePick) => void;
  onRemoveSaved: (place: SavedPlace) => void;
  /** The map: results open over it while searching. */
  children: ReactNode;
}

/**
 * The "Ghim vị trí" step's way to a pin other than the GPS fix: a search field
 * for an address, and the places pinned before (newest first) — as a chip row
 * under the field, and at the top of the results once the field is tapped.
 * Picking one moves the pin there and recentres the map.
 */
export function PlaceSearch({ savedPlaces, onPick, onRemoveSaved, children }: PlaceSearchProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const search = usePlaceSearch(query);
  const savedMatches = useMemo(() => filterSavedPlaces(savedPlaces, query), [savedPlaces, query]);
  const searching = query.trim().length >= MIN_PLACE_QUERY_LENGTH;
  const showResults = (focused || query.trim() !== "") && (savedMatches.length > 0 || searching);

  const pick = (next: PlacePick) => {
    Keyboard.dismiss();
    setQuery("");
    onPick(next);
  };
  const pickSaved = (place: SavedPlace) =>
    pick({ coords: { latitude: place.latitude, longitude: place.longitude }, placeName: place.place_name ?? null, note: place.note });

  return (
    <>
      <View style={styles.field}>
        <SearchIcon size={16} color={colors.textMuted} />
        <TextInput
          testID="input-location-search"
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={t("transactions.place.searchPlaceholder")}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => setQuery("")} hitSlop={HIT_SLOP} accessibilityRole="button" accessibilityLabel={t("common.action.clearSearch")}>
            <CloseIcon size={16} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {!showResults && savedPlaces.length > 0 ? (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chips}>
            {savedPlaces.slice(0, MAX_CHIPS).map((place) => (
              <Pressable
                key={`${place.latitude},${place.longitude}`}
                style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                onPress={() => pickSaved(place)}
                accessibilityRole="button"
                testID="chip-saved-place"
              >
                <HistoryIcon size={12} color={colors.textSecondary} />
                <Text style={styles.chipLabel} numberOfLines={1}>
                  {savedPlaceLabel(place) ?? t("transactions.place.unnamed")}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <EdgeFade width={CHIP_FADE_WIDTH} color={colors.surface} />
        </View>
      ) : null}

      <View style={styles.mapArea}>
        {children}
        {showResults ? (
          <ScrollView style={styles.results} keyboardShouldPersistTaps="handled" testID="list-location-results">
            {savedMatches.length > 0 ? <Text style={styles.section}>{t("transactions.place.savedHeader")}</Text> : null}
            {savedMatches.map((place) => (
              <Pressable
                key={`saved-${place.latitude},${place.longitude}`}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => pickSaved(place)}
                accessibilityRole="button"
              >
                <HistoryIcon size={16} color={colors.textSecondary} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {savedPlaceLabel(place) ?? t("transactions.place.unnamed")}
                  </Text>
                  {place.note && place.place_name ? (
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {place.place_name}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => onRemoveSaved(place)}
                  hitSlop={HIT_SLOP}
                  accessibilityRole="button"
                  accessibilityLabel={t("transactions.place.removeSaved")}
                >
                  <CloseIcon size={14} color={colors.textMuted} />
                </Pressable>
              </Pressable>
            ))}

            {searching ? <Text style={styles.section}>{t("transactions.place.resultsHeader")}</Text> : null}
            {searching && search.status === "searching" ? (
              <View style={styles.status}>
                <ActivityIndicator size="small" color={colors.green} />
                <Text style={styles.statusText}>{t("transactions.place.searching")}</Text>
              </View>
            ) : null}
            {searching && search.status === "failed" ? (
              <Text style={[styles.statusText, styles.status]}>{t("transactions.place.searchFailed")}</Text>
            ) : null}
            {searching && search.status === "done" && search.results.length === 0 ? (
              <Text style={[styles.statusText, styles.status]}>{t("transactions.place.noResults")}</Text>
            ) : null}
            {search.results.map((result) => (
              <Pressable
                key={result.key}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => pick({ coords: result.coords, placeName: result.placeName })}
                accessibilityRole="button"
                testID="row-location-result"
              >
                <MapPinIcon size={16} color={colors.green} />
                <Text style={[styles.rowTitle, styles.rowText]} numberOfLines={2}>
                  {result.title}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>
    </>
  );
}

const useStyles = createStyles((colors) => ({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.listCard,
    backgroundColor: colors.surfaceRaised,
  },
  input: { flex: 1, paddingVertical: 0, color: colors.textPrimary, ...typography.body },
  chips: { gap: spacing.sm, paddingRight: CHIP_FADE_WIDTH },
  chip: {
    maxWidth: 180,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  chipPressed: { backgroundColor: colors.surfaceRaised },
  chipLabel: { flexShrink: 1, ...typography.caption, color: colors.textPrimary },
  // The map's own box: results open over it rather than pushing it down.
  mapArea: { flex: 1 },
  results: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.listCard,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  section: { ...typography.tiny, color: colors.textSecondary, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  rowPressed: { backgroundColor: colors.surfaceRaised },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...typography.body, color: colors.textPrimary },
  rowSub: { ...typography.tiny, color: colors.textSecondary },
  status: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  statusText: { ...typography.caption, color: colors.textSecondary },
}));
