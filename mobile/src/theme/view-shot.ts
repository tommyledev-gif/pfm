// react-native-view-shot, loaded on first use instead of at import.
//
// Its JS entry resolves the native module eagerly (TurboModuleRegistry.
// getEnforcing), so a static import crashes the whole app at startup in any
// binary built before the dependency was added — a stale dev client or an
// old `expo run:android` build. The cross-fade is a nicety; losing it must
// cost an instant theme switch, not the app.
//
// The native module is probed BEFORE requiring the package: a require that
// throws is reported as fatal by Metro's module loader before any try/catch
// around it gets a say.
import { NativeModules, TurboModuleRegistry } from "react-native";

type ViewShot = typeof import("react-native-view-shot");

let cached: ViewShot | null | undefined;

export function loadViewShot(): ViewShot | null {
  if (cached === undefined) {
    const hasNative = TurboModuleRegistry.get("RNViewShot") != null || NativeModules.RNViewShot != null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = hasNative ? (require("react-native-view-shot") as ViewShot) : null;
  }
  return cached;
}
