import { Linking, Platform } from "react-native";

/**
 * Where a phone keeps its passkeys is a system setting, not something the app
 * can turn on. These open the right screen for the User to do it.
 *
 * Android 14+ (API 34) lists the "Mật khẩu, khóa truy cập và tài khoản"
 * services, Google among them: with none chosen, Credential Manager answers
 * NoCreateOption at once. Before 14 passkeys always go to Google Password
 * Manager, which only needs a Google account on the phone.
 */
const CREDENTIAL_PROVIDER_SETTINGS = "android.settings.CREDENTIAL_PROVIDER";
const ADD_ACCOUNT_SETTINGS = "android.settings.ADD_ACCOUNT_SETTINGS";
const MAIN_SETTINGS = "android.settings.SETTINGS";
const SYSTEM_PROVIDER_API = 34;

/** True where the phone picks its passkey service in Settings (Android 14+). */
export function choosesPasskeyProvider(): boolean {
  return Platform.OS === "android" && Number(Platform.Version) >= SYSTEM_PROVIDER_API;
}

/**
 * Opens the screen that fixes "no passkey service": the provider list on
 * Android 14+, adding an account before that. A phone without that screen
 * (some makers rename or drop it) gets its main Settings instead; iOS gets
 * the app's own settings page, the only one an app may open there.
 */
export async function openPasskeySettings(): Promise<void> {
  if (Platform.OS !== "android") {
    await Linking.openSettings();
    return;
  }
  const first = choosesPasskeyProvider() ? CREDENTIAL_PROVIDER_SETTINGS : ADD_ACCOUNT_SETTINGS;
  for (const action of [first, MAIN_SETTINGS]) {
    try {
      await Linking.sendIntent(action);
      return;
    } catch {
      // Not on this phone: try the next one.
    }
  }
}
