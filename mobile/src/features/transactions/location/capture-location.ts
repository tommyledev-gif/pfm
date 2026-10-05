import * as Location from "expo-location";
import { Platform } from "react-native";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Why no position came back — each has its own way out on the panel.
export type LocationFailure = "denied" | "services_off" | "unavailable";

export type CaptureResult = { ok: true; coords: Coordinates } | { ok: false; reason: LocationFailure };

// A fresh GPS fix can take a long while indoors, and on some Android devices
// getCurrentPositionAsync never settles at all. Past this, a recent last-known
// fix beats leaving the User on a spinner.
const FIX_TIMEOUT_MS = 15_000;
const LAST_KNOWN_MAX_AGE_MS = 2 * 60 * 1000;

function toCoordinates(position: Location.LocationObject): Coordinates {
  return { latitude: position.coords.latitude, longitude: position.coords.longitude };
}

/** Resolves null once `ms` pass without an answer. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// Location services switched off is a different problem from a refused
// permission: Android can offer its own "turn on location?" dialog for it,
// which rejects when the User says no. iOS has no such dialog.
async function ensureServicesEnabled(): Promise<boolean> {
  if (await Location.hasServicesEnabledAsync()) return true;
  if (Platform.OS !== "android") return false;
  try {
    await Location.enableNetworkProviderAsync();
  } catch {
    return false;
  }
  return Location.hasServicesEnabledAsync();
}

/**
 * The device's current position, for pinning a Transaction being created.
 * Asks for the permission and for location services as needed. Works offline:
 * GPS needs no network, only naming the place does (see place-name.ts).
 */
export async function captureCurrentLocation(): Promise<CaptureResult> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") return { ok: false, reason: "denied" };
    if (!(await ensureServicesEnabled())) return { ok: false, reason: "services_off" };

    const fresh = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      FIX_TIMEOUT_MS,
    );
    if (fresh) return { ok: true, coords: toCoordinates(fresh) };
    const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS });
    return lastKnown ? { ok: true, coords: toCoordinates(lastKnown) } : { ok: false, reason: "unavailable" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
