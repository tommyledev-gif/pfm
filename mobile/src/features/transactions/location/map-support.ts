import Constants, { ExecutionEnvironment } from "expo-constants";
import { Linking, Platform } from "react-native";

import { Coordinates } from "@/features/transactions/location/capture-location";

// react-native-maps draws Google Maps on Android, which needs an API key in
// every build of our own — Expo Go ships with its own — and a native map
// mounted without one crashes the app natively, with no JS error. iOS draws
// Apple Maps, which needs nothing. Without a map the pin is still captured
// and saved, and shown as coordinates with a link out to Google Maps.
//
// ⚠️ Decided by `extra.androidMapsReady`, not by the env variable alone: the
// variable was set while android/ had been generated before the key existed,
// so every map mount crashed. app.config.js sets the flag from the native
// manifest itself (Constants never exposes android.config — Expo strips it).
const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const ANDROID_MAPS_READY = Constants.expoConfig?.extra?.androidMapsReady === true;

export const CAN_RENDER_MAP = Platform.OS !== "android" || IS_EXPO_GO || ANDROID_MAPS_READY;

const COORDINATE_DECIMALS = 5;

export function formatCoordinates({ latitude, longitude }: Coordinates): string {
  return `${latitude.toFixed(COORDINATE_DECIMALS)}, ${longitude.toFixed(COORDINATE_DECIMALS)}`;
}

/** Opens the pin in the Google Maps app when installed, the browser otherwise. */
export function openInGoogleMaps({ latitude, longitude }: Coordinates): void {
  const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  Linking.openURL(url).catch(() => {});
}
