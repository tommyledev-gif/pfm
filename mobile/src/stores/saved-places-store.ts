import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// More than this is a list nobody scrolls; the oldest simply falls off.
export const MAX_SAVED_PLACES = 30;
// Two pins closer than this are the same place (GPS drifts by tens of metres
// indoors, and a nudged pin should not become a second entry).
const SAME_PLACE_METERS = 50;
const EARTH_RADIUS_METERS = 6_371_000;

export interface SavedPlace {
  latitude: number;
  longitude: number;
  place_name?: string;
  /** The User's own note about the place ("cổng sau, tầng 2"). */
  note?: string;
  /** When it was last pinned (epoch ms, device clock — ordering only). */
  at: number;
}

type PlacesByUser = Record<string, SavedPlace[]>;

// Shared empty list, so a selector for a User with no places returns the same
// reference every time instead of a fresh [] that re-renders forever.
const NO_PLACES: SavedPlace[] = [];

/** Great-circle distance between two pins, in metres (haversine). */
export function metersBetween(a: Pick<SavedPlace, "latitude" | "longitude">, b: Pick<SavedPlace, "latitude" | "longitude">): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

interface SavedPlacesState {
  byUser: PlacesByUser;
  /** Puts the pin first; a pin at an already saved place replaces it. */
  record: (userId: string, place: Omit<SavedPlace, "at">) => void;
  remove: (userId: string, place: Pick<SavedPlace, "latitude" | "longitude">) => void;
  /** Drops every place of a User removed from this device. */
  removeUser: (userId: string) => void;
}

/**
 * Places the User has pinned a Transaction to, newest first, per User, on
 * this device only — offered again by the "Ghim vị trí" step, so a regular
 * spot (the office canteen, a market stall) is one tap instead of a GPS fix
 * and a nudge. Written whenever a pin is confirmed (useLocationStep).
 */
export const useSavedPlacesStore = create<SavedPlacesState>()(
  persist(
    (set) => ({
      byUser: {},
      record: (userId, place) =>
        set((s) => {
          const list = s.byUser[userId] ?? NO_PLACES;
          const previous = list.find((p) => metersBetween(p, place) < SAME_PLACE_METERS);
          const next: SavedPlace = {
            ...place,
            // A pin confirmed without a name (offline) or note keeps the old one.
            place_name: place.place_name ?? previous?.place_name,
            note: place.note ?? previous?.note,
            at: Date.now(),
          };
          const rest = list.filter((p) => p !== previous);
          return { byUser: { ...s.byUser, [userId]: [next, ...rest].slice(0, MAX_SAVED_PLACES) } };
        }),
      remove: (userId, place) =>
        set((s) => ({
          byUser: {
            ...s.byUser,
            [userId]: (s.byUser[userId] ?? NO_PLACES).filter((p) => metersBetween(p, place) >= SAME_PLACE_METERS),
          },
        })),
      removeUser: (userId) =>
        set((s) => {
          const { [userId]: _dropped, ...rest } = s.byUser;
          return { byUser: rest };
        }),
    }),
    { name: "pfm_saved_places", storage: createJSONStorage(() => AsyncStorage) },
  ),
);

export function useSavedPlaces(userId: string | null): SavedPlace[] {
  return useSavedPlacesStore((s) => (userId ? s.byUser[userId] ?? NO_PLACES : NO_PLACES));
}
