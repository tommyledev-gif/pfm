import { NativeModules, Platform } from "react-native";
import { Passkey, PasskeyCreateRequest, PasskeyGetRequest } from "react-native-passkey";

/**
 * Passkeys run through the phone's own credential manager (Android Credential
 * Manager, iOS AuthenticationServices) via react-native-passkey — a native
 * module, so only in a dev/EAS build, never in Expo Go, and only on Android
 * 9+ / iOS 15+. Everywhere else the app keeps the device-only fingerprint
 * check (identity-check.ts) and password sign-in.
 */
export function passkeysAvailable(): boolean {
  return Boolean(NativeModules.Passkey) && Passkey.isSupported();
}

// cancelled: the User closed the sheet — say nothing. no-credential: this
// phone holds no passkey for the request (e.g. it was made on another phone).
// exists: this phone already holds one for the account (registration).
export type PasskeyFailure = "cancelled" | "no-credential" | "exists" | "failed";

export class PasskeyNativeError extends Error {
  constructor(
    readonly kind: PasskeyFailure,
    message: string,
  ) {
    super(message);
  }
}

function toNativeError(error: unknown): PasskeyNativeError {
  const code = (error as { error?: string } | null)?.error;
  const message = (error as { message?: string } | null)?.message ?? String(error);
  if (code === "UserCancelled") return new PasskeyNativeError("cancelled", message);
  if (code === "NoCredentials") return new PasskeyNativeError("no-credential", message);
  if (code === "CredentialAlreadyExists") return new PasskeyNativeError("exists", message);
  return new PasskeyNativeError("failed", message);
}

/**
 * Asks the phone to make a passkey for the server's `publicKey` options and
 * returns its answer, shaped as the server parses it. Some phones leave out
 * `type` / `rawId`; both are filled in, as the WebAuthn JSON requires them.
 */
export async function createPasskeyCredential(options: unknown): Promise<Record<string, unknown>> {
  try {
    const result = await Passkey.create(options as PasskeyCreateRequest);
    return { ...result, rawId: result.rawId ?? result.id, type: result.type ?? "public-key" };
  } catch (error) {
    throw toNativeError(error);
  }
}

/** Asks the phone to sign the server's challenge with a passkey it holds. */
export async function getPasskeyAssertion(options: unknown): Promise<Record<string, unknown>> {
  try {
    const result = await Passkey.get(options as PasskeyGetRequest);
    return { ...result, rawId: result.rawId ?? result.id, type: result.type ?? "public-key" };
  } catch (error) {
    throw toNativeError(error);
  }
}

/** "Samsung SM-S918B" — what the Security list calls the phone a passkey was made on. */
export function deviceName(): string {
  const constants = Platform.constants as { Brand?: string; Model?: string; Manufacturer?: string };
  if (Platform.OS === "ios") return "iPhone";
  const brand = constants.Brand ?? constants.Manufacturer ?? "";
  const model = constants.Model ?? "";
  const name = `${brand.charAt(0).toUpperCase()}${brand.slice(1)} ${model}`.trim();
  return name || "Điện thoại";
}
