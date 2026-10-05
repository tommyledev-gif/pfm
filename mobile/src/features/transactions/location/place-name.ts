import * as Location from "expo-location";

import { Coordinates, withTimeout } from "@/features/transactions/location/capture-location";

// Same ceiling as the backend's place_name validation.
export const PLACE_NAME_MAX_LENGTH = 200;

// Saving waits for the name, so a geocoder that never answers must not hold
// the button hostage.
const NAME_TIMEOUT_MS = 6_000;

const CITY_PREFIX = /^Thành phố\s+/i;

function clean(part: string | null | undefined): string | null {
  const trimmed = part?.trim();
  return trimmed ? trimmed.replace(CITY_PREFIX, "TP. ") : null;
}

/**
 * "Quận 1, TP. Hồ Chí Minh": the district, then the city or province. Each
 * platform fills the fields differently for Vietnam: Android's geocoder puts
 * the quận/huyện in `subregion` and the city in `region`, while iOS may leave
 * `subregion` empty and carry the area in `district` or `city` instead, so
 * every candidate is tried in order and duplicates are dropped.
 */
export function formatPlaceName(address: Location.LocationGeocodedAddress): string | null {
  const area = clean(address.subregion) ?? clean(address.district) ?? clean(address.city);
  const city = clean(address.region) ?? clean(address.city);
  const parts = [area, city].filter((p): p is string => p !== null);
  const unique = parts.filter((p, i) => parts.findIndex((q) => q.toLowerCase() === p.toLowerCase()) === i);
  const label = unique.length > 0 ? unique.join(", ") : clean(address.formattedAddress);
  return label ? label.slice(0, PLACE_NAME_MAX_LENGTH) : null;
}

/**
 * The area a pin falls in, or null when no geocoder answers — which is the
 * normal case offline (both platforms' geocoders need the network). A pin
 * without a name is still saved; its coordinates are what matter.
 */
export async function resolvePlaceName(coords: Coordinates): Promise<string | null> {
  try {
    const [address] = (await withTimeout(Location.reverseGeocodeAsync(coords), NAME_TIMEOUT_MS)) ?? [];
    return address ? formatPlaceName(address) : null;
  } catch {
    return null;
  }
}
