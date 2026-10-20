import { NativeModules, Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { Passkey, PasskeyCreateRequest, PasskeyGetRequest } from "react-native-passkey";

import { useDebugLogStore } from "@/stores/debug-log-store";

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
// no-provider: no password service on the phone took the request (none on, no
// Google account, or the one on refused this app: an APK signing key missing
// from the server's assetlinks.json shows up exactly like this). timeout: the phone never
// answered (see NATIVE_TIMEOUT_MS).
export type PasskeyFailure = "cancelled" | "no-credential" | "exists" | "no-provider" | "timeout" | "failed";

export class PasskeyNativeError extends Error {
  constructor(
    readonly kind: PasskeyFailure,
    message: string,
  ) {
    super(message);
  }
}

// How long the phone gets to answer. The system sheet opens within a second
// or two, and nobody leaves it open this long; past it the call is treated as
// lost. On some phones Credential Manager's call never returned at all, which
// left "Thêm passkey" spinning for good (2026-10-16).
const NATIVE_TIMEOUT_MS = 90_000;

function toNativeError(error: unknown): PasskeyNativeError {
  const code = (error as { error?: string } | null)?.error;
  const message = (error as { message?: string } | null)?.message ?? String(error);
  if (code === "UserCancelled") return new PasskeyNativeError("cancelled", message);
  if (code === "NoCredentials") return new PasskeyNativeError("no-credential", message);
  if (code === "CredentialAlreadyExists") return new PasskeyNativeError("exists", message);
  if (code === "NoCreateOption" || code === "NotConfigured") return new PasskeyNativeError("no-provider", message);
  return new PasskeyNativeError("failed", message);
}

/**
 * Runs one native passkey call with a watchdog, and writes how it ended —
 * code, message, how long it took — to the debug console, so a failure on a
 * phone can be read there without a cable.
 */
async function runNative<T>(label: string, call: () => Promise<T>): Promise<T> {
  const log = useDebugLogStore.getState().append;
  const startedAt = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const watchdog = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new PasskeyNativeError("timeout", `no answer after ${NATIVE_TIMEOUT_MS / 1000}s`)),
      NATIVE_TIMEOUT_MS,
    );
  });
  try {
    const result = await Promise.race([call(), watchdog]);
    log("api", `passkey ${label}: ok`, { ms: Date.now() - startedAt });
    return result;
  } catch (error) {
    const failure = error instanceof PasskeyNativeError ? error : toNativeError(error);
    log("error", `passkey ${label}: ${failure.kind}`, {
      code: (error as { error?: string } | null)?.error,
      message: failure.message,
      ms: Date.now() - startedAt,
      platform: `${Platform.OS} ${String(Platform.Version)}`,
    });
    throw failure;
  } finally {
    clearTimeout(timer);
  }
}

// The fields filled in below; the rest of the credential JSON passes through.
interface CredentialFields {
  id?: string;
  rawId?: string;
  type?: string;
}

interface NativePasskeyPlayServices {
  create(requestJson: string): Promise<string>;
  get(requestJson: string): Promise<string>;
}

// Where androidx.credentials (inside react-native-passkey) switches from
// Google Play Services to Android's own Credential Manager.
const SYSTEM_CREDENTIAL_MANAGER_API = 34;

// modules/passkey-play-services: the same request through Google Play
// Services' FIDO2 API, as Chrome and most apps send it. Some makers' Android
// 14 builds (a Vivo V2352A, 2026-10-20) never pass the system Credential
// Manager's requests on to Google: "No create options available." in ~40 ms
// with Google on in every setting, while other apps save passkeys fine. Null
// below Android 14 (react-native-passkey already goes through Play Services
// there) and in a build without the module.
const playServices =
  Platform.OS === "android" && Number(Platform.Version) >= SYSTEM_CREDENTIAL_MANAGER_API
    ? requireOptionalNativeModule<NativePasskeyPlayServices>("PasskeyPlayServices")
    : null;

/** The failure code: react-native-passkey's `{ error }` or an Expo module's `{ code }`. */
function failureCode(error: unknown): string | undefined {
  const e = error as { error?: string; code?: string } | null;
  return e?.error ?? e?.code;
}

/**
 * The retry through Play Services, after the system Credential Manager said
 * `primaryError`. Its failures are reshaped like react-native-passkey's, so
 * toNativeError reads both paths the same way.
 */
async function viaPlayServices(label: string, call: (native: NativePasskeyPlayServices) => Promise<string>, primaryError: unknown): Promise<CredentialFields> {
  if (!playServices) throw primaryError;
  useDebugLogStore.getState().append("api", `passkey ${label}: system refused (${failureCode(primaryError)}), retrying through Play Services`);
  try {
    return JSON.parse(await call(playServices)) as CredentialFields;
  } catch (error) {
    throw { error: failureCode(error), message: (error as { message?: string } | null)?.message ?? String(error) };
  }
}

/**
 * Asks the phone to make a passkey for the server's `publicKey` options and
 * returns its answer, shaped as the server parses it. Some phones leave out
 * `type` / `rawId`; both are filled in, as the WebAuthn JSON requires them.
 * "No create option" from Android 14's Credential Manager is retried once
 * through Play Services (see playServices above).
 */
export async function createPasskeyCredential(options: unknown): Promise<Record<string, unknown>> {
  const result = await runNative("create", async (): Promise<CredentialFields> => {
    try {
      return await Passkey.create(options as PasskeyCreateRequest);
    } catch (error) {
      if (failureCode(error) !== "NoCreateOption") throw error;
      return viaPlayServices("create", (native) => native.create(JSON.stringify(options)), error);
    }
  });
  return { ...result, rawId: result.rawId ?? result.id, type: result.type ?? "public-key" };
}

/**
 * Asks the phone to sign the server's challenge with a passkey it holds.
 * "No credentials" from Android 14's Credential Manager is retried once
 * through Play Services, which on the phones above is the only path that sees
 * Google's passkeys. If that also finds nothing, the first answer stands; a
 * User who closes Google's sheet has cancelled.
 */
export async function getPasskeyAssertion(options: unknown): Promise<Record<string, unknown>> {
  const result = await runNative("get", async (): Promise<CredentialFields> => {
    try {
      return await Passkey.get(options as PasskeyGetRequest);
    } catch (error) {
      if (failureCode(error) !== "NoCredentials" || !playServices) throw error;
      try {
        return await viaPlayServices("get", (native) => native.get(JSON.stringify(options)), error);
      } catch (retryError) {
        throw failureCode(retryError) === "UserCancelled" ? retryError : error;
      }
    }
  });
  return { ...result, rawId: result.rawId ?? result.id, type: result.type ?? "public-key" };
}

