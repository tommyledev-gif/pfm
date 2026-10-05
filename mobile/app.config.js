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
module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!googleMapsApiKey) return config;
  return {
    ...config,
    android: {
      ...config.android,
      config: { ...config.android?.config, googleMaps: { apiKey: googleMapsApiKey } },
    },
  };
};
