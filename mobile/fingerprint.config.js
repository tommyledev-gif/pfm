// What counts as "native" for runtimeVersion (app.json policy "fingerprint").
// A change to anything the fingerprint covers needs a new APK; everything
// else ships as an OTA update (scripts/ota/, docs/ops-runbook.md §8).
//
// Skipped, because none of them change the native code an update runs on:
// - version and android.versionCode: build-apk bumps versionCode on every
//   build, and counting it would cut every older APK off from OTA updates
//   even when nothing native changed.
// - package.json scripts: by default adding one would force a new APK.
const { SourceSkips } = require("expo/fingerprint");

/** @type {import('expo/fingerprint').Config} */
module.exports = {
  sourceSkips: SourceSkips.ExpoConfigVersions | SourceSkips.PackageJsonScriptsAll,
};
