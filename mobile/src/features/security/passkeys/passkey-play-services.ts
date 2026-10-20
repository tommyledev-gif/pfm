import { AppState, Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

import { useDebugLogStore } from "@/stores/debug-log-store";

/** The fields native-passkey.ts fills in; the rest of the credential JSON passes through. */
export interface CredentialFields {
  id?: string;
  rawId?: string;
  type?: string;
}

type Ceremony = "create" | "get";

interface NativePasskeyPlayServices {
  create(requestJson: string): Promise<string>;
  get(requestJson: string): Promise<string>;
}

// Where androidx.credentials (inside react-native-passkey) switches from
// Google Play Services to Android's own Credential Manager.
const SYSTEM_CREDENTIAL_MANAGER_API = 34;

// How long Android's Credential Manager gets to put its sheet up. On a phone
// where it works the sheet is there within a second or two; with no sheet by
// then and no answer either, the call is taken as lost.
const SYSTEM_SHEET_WAIT_MS = 5000;

// What the system path answers with on the phones below, at once.
const SYSTEM_REFUSALS: Record<Ceremony, string> = { create: "NoCreateOption", get: "NoCredentials" };

// modules/passkey-play-services: the same request through Google Play
// Services, the way Chrome and most apps reach Google Password Manager. Some
// makers' Android 14 builds never pass the system Credential Manager's
// requests on to Google (a Vivo V2352A, 2026-10-20: adding answered "No create
// options available." in ~40 ms, signing in never answered at all, with
// Google on in every setting while other apps used passkeys fine). Null below
// Android 14 (react-native-passkey already goes through Play Services there),
// on iOS, and in a build without the module.
const playServices =
  Platform.OS === "android" && Number(Platform.Version) >= SYSTEM_CREDENTIAL_MANAGER_API
    ? requireOptionalNativeModule<NativePasskeyPlayServices>("PasskeyPlayServices")
    : null;

// Set once the system path is known not to work on this phone (it refused to
// add, or put no sheet up): later calls in this run go straight to Play
// Services instead of failing or waiting on it again.
let systemPathDead = false;

const NO_SHEET = Symbol("no-sheet");

/** The failure code: react-native-passkey's `{ error }` or an Expo module's `{ code }`. */
export function failureCode(error: unknown): string | undefined {
  const e = error as { error?: string; code?: string } | null;
  return e?.error ?? e?.code;
}

/**
 * The system call's outcome, or NO_SHEET when it is still pending
 * SYSTEM_SHEET_WAIT_MS later and the app was never covered: every passkey
 * sheet is an activity over the app, which takes it out of "active". Once a
 * sheet has shown, it waits for the answer however long the User takes.
 */
function unlessNoSheet<T>(call: Promise<T>): Promise<T | typeof NO_SHEET> {
  return new Promise((resolve, reject) => {
    let sheetSeen = AppState.currentState !== "active";
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") sheetSeen = true;
    });
    const timer = setTimeout(() => {
      if (sheetSeen) return;
      subscription.remove();
      resolve(NO_SHEET);
    }, SYSTEM_SHEET_WAIT_MS);
    const settle = () => {
      clearTimeout(timer);
      subscription.remove();
    };
    // Also handles a lost call answering late: its result is dropped.
    call.then(
      (value) => {
        settle();
        resolve(value);
      },
      (error: unknown) => {
        settle();
        reject(error);
      },
    );
  });
}

async function viaPlayServices(ceremony: Ceremony, requestJson: string, reason: string): Promise<CredentialFields> {
  useDebugLogStore.getState().append("api", `passkey ${ceremony}: ${reason}, using Play Services`);
  try {
    // Non-null: only reached when the module is there.
    return JSON.parse(await playServices![ceremony](requestJson)) as CredentialFields;
  } catch (error) {
    // Reshaped like react-native-passkey's errors, so both read the same.
    throw { error: failureCode(error), message: (error as { message?: string } | null)?.message ?? String(error) };
  }
}

/**
 * Runs one passkey ceremony through react-native-passkey (`system`) and, on
 * Android 14+, again through Google Play Services when the system Credential
 * Manager refused at once (SYSTEM_REFUSALS) or put no sheet up in time.
 *
 * Signing in, "no credentials" is also a true answer on a phone where the
 * system path works and holds no passkey: Google is asked too, and if it has
 * nothing either the system's answer stands; a closed Google sheet is a cancel.
 */
export async function withPlayServicesFallback(
  ceremony: Ceremony,
  options: unknown,
  system: () => Promise<CredentialFields>,
): Promise<CredentialFields> {
  if (!playServices) return system();
  const requestJson = JSON.stringify(options);
  if (systemPathDead) return viaPlayServices(ceremony, requestJson, "system path failed earlier");

  let outcome: CredentialFields | typeof NO_SHEET;
  try {
    outcome = await unlessNoSheet(system());
  } catch (error) {
    if (failureCode(error) !== SYSTEM_REFUSALS[ceremony]) throw error;
    // Refusing to add says the path is broken here; "no credentials" does not.
    if (ceremony === "create") systemPathDead = true;
    try {
      return await viaPlayServices(ceremony, requestJson, `system refused (${failureCode(error)})`);
    } catch (retryError) {
      throw ceremony === "get" && failureCode(retryError) !== "UserCancelled" ? error : retryError;
    }
  }
  if (outcome !== NO_SHEET) return outcome;
  systemPathDead = true;
  return viaPlayServices(ceremony, requestJson, `no system sheet after ${SYSTEM_SHEET_WAIT_MS / 1000}s`);
}
