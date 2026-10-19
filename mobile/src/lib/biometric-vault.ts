import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

// modules/biometric-vault (Android only): a Keystore key pair per locked
// account. Sealing needs no prompt; opening needs the owner's fingerprint, or
// from Android 11 the phone's PIN instead.
interface NativeBiometricVault {
  availability(): "available" | "none";
  seal(alias: string, plaintext: string): Promise<string>;
  open(alias: string, sealed: string, title: string, cancelLabel: string): Promise<string>;
  remove(alias: string): void;
}

const native = Platform.OS === "android" ? requireOptionalNativeModule<NativeBiometricVault>("BiometricVault") : null;

export type VaultFailure = "cancelled" | "invalidated" | "lockout" | "unavailable" | "failed";

export class VaultError extends Error {
  constructor(
    readonly kind: VaultFailure,
    message: string,
  ) {
    super(message);
    this.name = "VaultError";
  }
}

const KIND_BY_CODE: Record<string, VaultFailure> = {
  ERR_VAULT_CANCELLED: "cancelled",
  ERR_VAULT_INVALIDATED: "invalidated",
  ERR_VAULT_LOCKOUT: "lockout",
  ERR_VAULT_UNAVAILABLE: "unavailable",
};

const CANCEL_LABEL = "Hủy";
const aliasFor = (userId: string) => `pfm_vault_${userId}`;

function toVaultError(error: unknown): VaultError {
  const code = (error as { code?: unknown } | null)?.code;
  const kind = typeof code === "string" ? (KIND_BY_CODE[code] ?? "failed") : "failed";
  return new VaultError(kind, error instanceof Error ? error.message : String(error));
}

/** This build carries the vault (a release/dev APK; never Expo Go or iOS). */
export function vaultInstalled(): boolean {
  return native !== null;
}

/**
 * The phone can lock an account right now: the vault is in this build and
 * the phone has a strong biometric — or, from Android 11, any screen lock.
 */
export function vaultReady(): boolean {
  try {
    return native?.availability() === "available";
  } catch {
    return false;
  }
}

/** Seals the account's refresh token. No prompt. */
export async function sealAccountToken(userId: string, refreshToken: string): Promise<string> {
  if (!native) throw new VaultError("unavailable", "vault not in this build");
  try {
    return await native.seal(aliasFor(userId), refreshToken);
  } catch (error) {
    throw toVaultError(error);
  }
}

/** Shows the system prompt and returns the account's refresh token. */
export async function openAccountToken(userId: string, sealed: string, title: string): Promise<string> {
  if (!native) throw new VaultError("unavailable", "vault not in this build");
  try {
    return await native.open(aliasFor(userId), sealed, title, CANCEL_LABEL);
  } catch (error) {
    throw toVaultError(error);
  }
}

/** Deletes the account's key: whatever was sealed with it can never be read again. */
export function forgetAccountKey(userId: string): void {
  try {
    native?.remove(aliasFor(userId));
  } catch {
    // Nothing to delete.
  }
}
