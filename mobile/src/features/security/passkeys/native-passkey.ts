import { NativeModules, Platform } from "react-native";
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
// no-provider: nothing on the phone can store passkeys (no Google account in
// Google Password Manager, provider turned off). timeout: the phone never
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

/**
 * Asks the phone to make a passkey for the server's `publicKey` options and
 * returns its answer, shaped as the server parses it. Some phones leave out
 * `type` / `rawId`; both are filled in, as the WebAuthn JSON requires them.
 */
export async function createPasskeyCredential(options: unknown): Promise<Record<string, unknown>> {
  const result = await runNative("create", () => Passkey.create(options as PasskeyCreateRequest));
  return { ...result, rawId: result.rawId ?? result.id, type: result.type ?? "public-key" };
}

/** Asks the phone to sign the server's challenge with a passkey it holds. */
export async function getPasskeyAssertion(options: unknown): Promise<Record<string, unknown>> {
  const result = await runNative("get", () => Passkey.get(options as PasskeyGetRequest));
  return { ...result, rawId: result.rawId ?? result.id, type: result.type ?? "public-key" };
}

