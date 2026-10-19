import { useQuery } from "@tanstack/react-query";
import { Platform } from "react-native";
import * as Updates from "expo-updates";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import { NativeUpdateStatus } from "@/features/app-update/types";

/**
 * The native code this APK was built with (app.json runtimeVersion, a
 * fingerprint). Null where nothing can fall behind: Expo Go and dev builds
 * (no OTA updates at all) and iOS (no APK to download).
 */
const runtimeVersion = Updates.isEnabled && Platform.OS === "android" ? Updates.runtimeVersion : null;

/**
 * Asks once per launch whether this phone has to install the newest APK.
 * OTA updates carry JS only; after a native change they go to the new APK's
 * runtime, and a phone left on the old APK would silently stop changing.
 * The server decides (service.NativeUpdate), from what was uploaded.
 *
 * Not saved for offline: a stale "yes" must not block a phone that has
 * already installed the new APK (its runtime, and so this key, differ).
 */
export function useNativeUpdateQuery() {
  return useQuery({
    queryKey: ["app-update", "native", runtimeVersion],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<NativeUpdateStatus>>("/app-updates/apk/status", {
        params: { platform: Platform.OS, runtime_version: runtimeVersion },
      });
      return unwrap(res.data);
    },
    enabled: runtimeVersion !== null,
    // Once per launch is enough: installing the APK restarts the app.
    staleTime: Infinity,
    retry: 2,
  });
}
