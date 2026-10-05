import Constants, { ExecutionEnvironment } from "expo-constants";
import { Linking, Platform } from "react-native";

import { Coordinates } from "@/features/transactions/location/capture-location";

// react-native-maps draws Google Maps on Android, which needs an API key in
// every build of our own — Expo Go ships with its own — and a native map
// mounted without one crashes the app. The key reaches the Android manifest
// through app.config.js from EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, and the same
// variable decides it here: Constants.expoConfig never exposes android.config
// at runtime (Expo strips it as private). iOS draws Apple Maps, which needs
// nothing. Without a map the pin is still captured and saved, and shown as
// coordinates with a link out to Google Maps.
const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const HAS_GOOGLE_MAPS_KEY = Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY);

export const CAN_RENDER_MAP = Platform.OS !== "android" || IS_EXPO_GO || HAS_GOOGLE_MAPS_KEY;

const COORDINATE_DECIMALS = 5;

export function formatCoordinates({ latitude, longitude }: Coordinates): string {
  return `${latitude.toFixed(COORDINATE_DECIMALS)}, ${longitude.toFixed(COORDINATE_DECIMALS)}`;
}

/** Opens the pin in the Google Maps app when installed, the browser otherwise. */
export function openInGoogleMaps({ latitude, longitude }: Coordinates): void {
  const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  Linking.openURL(url).catch(() => {});
}
