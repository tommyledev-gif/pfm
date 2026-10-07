// Extends app.json (passed in as `config`) with what it cannot hold: values
// read from the environment at build time.
//
// Google Maps on Android (react-native-maps, the transaction location pin)
// needs an API key in every build of our own — Expo Go ships with its own.
// Without a key the app still builds and runs: the location step falls back
// to coordinates plus a link to Google Maps instead of drawing a map, decided
// at runtime from the same variable (src/features/transactions/location/
// map-support.ts). Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in mobile/.env for local
// builds and in eas.json's build profile `env` for EAS builds.
//
// ⚠️ The key lands in the Android manifest only when `expo prebuild` runs.
// A native project generated before the key (or the map feature) existed
// still builds fine, but its first MapView kills the app natively — no JS
// error, nothing to see. So the native manifest itself is read here, and
// `extra.androidMapsReady` (what map-support.ts trusts) is true only when it
// really carries the key. This file is evaluated again by the Android build
// (expo-constants embeds the config), so a release APK's flag describes that
// APK's own manifest.
const fs = require("fs");
const path = require("path");

const MAPS_KEY_META_DATA = "com.google.android.geo.API_KEY";
// eslint-disable-next-line no-undef -- a Node config file; __dirname exists here.
const NATIVE_MANIFEST = path.join(__dirname, "android", "app", "src", "main", "AndroidManifest.xml");

// null: no native project yet — prebuild (local or on EAS) will write the key.
function nativeManifestHasMapsKey() {
  if (!fs.existsSync(NATIVE_MANIFEST)) return null;
  return fs.readFileSync(NATIVE_MANIFEST, "utf8").includes(MAPS_KEY_META_DATA);
}

module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const inManifest = googleMapsApiKey ? nativeManifestHasMapsKey() : false;
  if (googleMapsApiKey && inManifest === false) {
    console.warn(
      "\n⚠️  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is set, but android/ was generated without it — the map is " +
        "disabled until you run `npx expo prebuild --platform android` and rebuild the app.\n",
    );
  }
  const extra = { ...config.extra, androidMapsReady: Boolean(googleMapsApiKey) && inManifest !== false };
  if (!googleMapsApiKey) return { ...config, extra };
  return {
    ...config,
    extra,
    android: {
      ...config.android,
      config: { ...config.android?.config, googleMaps: { apiKey: googleMapsApiKey } },
    },
  };
};
