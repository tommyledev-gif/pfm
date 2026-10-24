import { create } from "zustand";

import {
  PIN_CHECK_TARGET_MS,
  PIN_MAX_WRONG,
  PIN_PBKDF2_MAX_ITERATIONS,
  PIN_PBKDF2_MIN_ITERATIONS,
  PIN_PBKDF2_PROBE_ITERATIONS,
  PIN_SALT_BYTES,
  SECURE_STORE_PIN_KEY,
  SECURE_STORE_PIN_WRONG_KEY,
} from "@/lib/constants";
import { bytesToHex, constantTimeEqual, hexToBytes, pbkdf2Sha256, utf8Bytes } from "@/lib/crypto/sha256";
import { secureStorage } from "@/lib/secure-storage";

// What secure storage holds for the PIN: never the digits (BR-02).
interface StoredPin {
  v: 1;
  salt: string;
  iterations: number;
  hash: string;
}

export type PinCheck =
  | { result: "right" }
  | { result: "wrong"; triesLeft: number }
  /** No PIN, or its record cannot be read (EC-4): treat as no PIN. */
  | { result: "missing" };

interface PinState {
  isHydrated: boolean;
  hasPin: boolean;
  hydrate: () => Promise<void>;
  setPin: (pin: string) => Promise<void>;
  checkPin: (pin: string) => Promise<PinCheck>;
  /** Fingerprint, face or the screen lock passed: the wrong count starts over. */
  resetWrongCount: () => Promise<void>;
  clearPin: () => Promise<void>;
}

function parseStored(raw: string | null): StoredPin | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredPin>;
    if (parsed.v !== 1 || !parsed.salt || !parsed.hash || !Number.isInteger(parsed.iterations)) return null;
    return parsed as StoredPin;
  } catch {
    return null;
  }
}

async function readStored(): Promise<StoredPin | null> {
  try {
    return parseStored(await secureStorage.getItem(SECURE_STORE_PIN_KEY));
  } catch {
    return null;
  }
}

async function readWrongCount(): Promise<number> {
  try {
    const n = Number(await secureStorage.getItem(SECURE_STORE_PIN_WRONG_KEY));
    return Number.isInteger(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

// The salt only has to be unique; the record's secrecy comes from the
// Keystore-backed storage. Web crypto when the runtime has it.
function randomSalt(): Uint8Array {
  const salt = new Uint8Array(PIN_SALT_BYTES);
  const webCrypto = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } }).crypto;
  if (typeof webCrypto?.getRandomValues === "function") return webCrypto.getRandomValues(salt);
  const seed = Date.now();
  for (let i = 0; i < salt.length; i++) salt[i] = (Math.random() * 256) ^ ((seed >>> ((i % 4) * 8)) & 0xff);
  return salt;
}

// As many iterations as this phone runs in about PIN_CHECK_TARGET_MS: plain
// JS, so a slow phone would otherwise freeze on every check.
function iterationsForThisPhone(pin: Uint8Array, salt: Uint8Array): number {
  const start = Date.now();
  pbkdf2Sha256(pin, salt, PIN_PBKDF2_PROBE_ITERATIONS);
  const elapsed = Math.max(1, Date.now() - start);
  const scaled = Math.round((PIN_PBKDF2_PROBE_ITERATIONS * PIN_CHECK_TARGET_MS) / elapsed);
  return Math.min(PIN_PBKDF2_MAX_ITERATIONS, Math.max(PIN_PBKDF2_MIN_ITERATIONS, scaled));
}

/**
 * The app PIN (specs/mobile-app-pin): one per phone, shared by every saved
 * account. Only whether one is set is held in memory; the record and the
 * wrong-try count stay in secure storage, and the count is written before a
 * wrong answer is shown, so killing the app never resets it (EC-2).
 */
export const usePinStore = create<PinState>((set) => ({
  isHydrated: false,
  hasPin: false,

  async hydrate() {
    const stored = await readStored();
    set({ hasPin: stored !== null, isHydrated: true });
  },

  async setPin(pin) {
    const digits = utf8Bytes(pin);
    const salt = randomSalt();
    const iterations = iterationsForThisPhone(digits, salt);
    const record: StoredPin = { v: 1, salt: bytesToHex(salt), iterations, hash: bytesToHex(pbkdf2Sha256(digits, salt, iterations)) };
    await secureStorage.setItem(SECURE_STORE_PIN_KEY, JSON.stringify(record));
    await secureStorage.removeItem(SECURE_STORE_PIN_WRONG_KEY).catch(() => {});
    set({ hasPin: true });
  },

  async checkPin(pin) {
    const stored = await readStored();
    if (!stored) {
      set({ hasPin: false });
      return { result: "missing" };
    }
    const wrongSoFar = await readWrongCount();
    // Over the limit already (the app was killed before the sign-out ran):
    // no more tries, whatever is typed.
    if (wrongSoFar >= PIN_MAX_WRONG) return { result: "wrong", triesLeft: 0 };

    const hash = pbkdf2Sha256(utf8Bytes(pin), hexToBytes(stored.salt), stored.iterations);
    if (constantTimeEqual(hash, hexToBytes(stored.hash))) {
      if (wrongSoFar > 0) await secureStorage.removeItem(SECURE_STORE_PIN_WRONG_KEY).catch(() => {});
      return { result: "right" };
    }
    // Not caught: a count that cannot be stored must not become a free try.
    const wrong = wrongSoFar + 1;
    await secureStorage.setItem(SECURE_STORE_PIN_WRONG_KEY, String(wrong));
    return { result: "wrong", triesLeft: Math.max(0, PIN_MAX_WRONG - wrong) };
  },

  async resetWrongCount() {
    await secureStorage.removeItem(SECURE_STORE_PIN_WRONG_KEY).catch(() => {});
  },

  async clearPin() {
    await secureStorage.removeItem(SECURE_STORE_PIN_KEY).catch(() => {});
    await secureStorage.removeItem(SECURE_STORE_PIN_WRONG_KEY).catch(() => {});
    set({ hasPin: false });
  },
}));
