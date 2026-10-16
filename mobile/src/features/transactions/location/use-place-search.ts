import * as Location from "expo-location";
import { useEffect, useState } from "react";

import { normalizeText } from "@/lib/normalize-text";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { SavedPlace } from "@/stores/saved-places-store";
import { Coordinates, withTimeout } from "@/features/transactions/location/capture-location";
import { formatPlaceName } from "@/features/transactions/location/place-name";

// Shorter than this matches half the country.
export const MIN_PLACE_QUERY_LENGTH = 3;
// Each search is a geocoder round trip; typing should not fire one per key.
const SEARCH_DEBOUNCE_MS = 500;
const SEARCH_TIMEOUT_MS = 8_000;
const MAX_RESULTS = 5;

export interface PlaceResult {
  key: string;
  coords: Coordinates;
  /** What the row shows: the full address when the geocoder has one. */
  title: string;
  /** The area name a pin is saved with ("Quận 1, TP. Hồ Chí Minh"). */
  placeName: string | null;
}

export type PlaceSearchStatus = "idle" | "searching" | "done" | "failed";

interface SearchState {
  query: string;
  status: PlaceSearchStatus;
  results: PlaceResult[];
}

/**
 * Addresses matching `query`, through the phone's own geocoder (expo-location:
 * Android's Geocoder, Apple's CLGeocoder) — no map API key, no new native
 * module. Both need the network. Best with an address or street name; a shop
 * name alone is hit and miss.
 */
export function usePlaceSearch(query: string): { status: PlaceSearchStatus; results: PlaceResult[] } {
  const trimmed = query.trim();
  const debounced = useDebouncedValue(trimmed, SEARCH_DEBOUNCE_MS);
  const [state, setState] = useState<SearchState>({ query: "", status: "idle", results: [] });

  useEffect(() => {
    if (debounced.length < MIN_PLACE_QUERY_LENGTH) {
      setState({ query: debounced, status: "idle", results: [] });
      return;
    }
    let cancelled = false;
    setState({ query: debounced, status: "searching", results: [] });
    geocode(debounced).then(
      (results) => {
        if (!cancelled) setState({ query: debounced, status: "done", results });
      },
      () => {
        if (!cancelled) setState({ query: debounced, status: "failed", results: [] });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  if (trimmed.length < MIN_PLACE_QUERY_LENGTH) return { status: "idle", results: [] };
  // Typed ahead of the debounce: the last answer was for another query.
  if (trimmed !== state.query) return { status: "searching", results: [] };
  return { status: state.status, results: state.results };
}

async function geocode(query: string): Promise<PlaceResult[]> {
  const found = await withTimeout(Location.geocodeAsync(query), SEARCH_TIMEOUT_MS);
  if (found === null) throw new Error("place search timed out");
  return Promise.all(
    found.slice(0, MAX_RESULTS).map(async (point, index) => {
      const coords = { latitude: point.latitude, longitude: point.longitude };
      const address = await withTimeout(Location.reverseGeocodeAsync(coords), SEARCH_TIMEOUT_MS)
        .then((list) => list?.[0] ?? null)
        .catch(() => null);
      return {
        key: `${coords.latitude},${coords.longitude},${index}`,
        coords,
        title: (address && describeAddress(address)) || query,
        placeName: address ? formatPlaceName(address) : null,
      };
    }),
  );
}

/** "12 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh" — the most specific line available. */
function describeAddress(address: Location.LocationGeocodedAddress): string | null {
  if (address.formattedAddress?.trim()) return address.formattedAddress.trim();
  const street = [address.streetNumber, address.street].filter(Boolean).join(" ");
  const parts = [address.name !== street ? address.name : null, street, address.district ?? address.subregion, address.city ?? address.region];
  const kept = parts.filter((p): p is string => Boolean(p?.trim()));
  const unique = kept.filter((p, i) => kept.findIndex((q) => q.toLowerCase() === p.toLowerCase()) === i);
  return unique.length > 0 ? unique.join(", ") : null;
}

/** Saved places whose name or note matches `query` (case and accents ignored); all of them for an empty one. */
export function filterSavedPlaces(places: SavedPlace[], query: string): SavedPlace[] {
  const key = normalizeText(query.trim());
  if (!key) return places;
  return places.filter((p) => normalizeText(`${p.note ?? ""} ${p.place_name ?? ""}`).includes(key));
}

/** How a saved place is named in a list: its note, else its area. */
export function savedPlaceLabel(place: SavedPlace): string | null {
  return place.note?.trim() || place.place_name?.trim() || null;
}
