import { Platform } from "react-native";
import type { InternalAxiosRequestConfig } from "axios";

import { SECURE_STORE_DEVICE_ID_KEY } from "@/lib/constants";
import { newIdempotencyKey } from "@/lib/idempotency-key";
import { secureStorage } from "@/lib/secure-storage";

// Mirrors common.HeaderDeviceID / common.HeaderDeviceName (backend
// internal/common/constants_session.go).
const HEADER_DEVICE_ID = "X-Device-Id";
const HEADER_DEVICE_NAME = "X-Device-Name";

/** "Samsung SM-S918B" — what the Security screen's lists call this phone. */
export function deviceName(): string {
  const constants = Platform.constants as { Brand?: string; Model?: string; Manufacturer?: string };
  if (Platform.OS === "ios") return "iPhone";
  const brand = constants.Brand ?? constants.Manufacturer ?? "";
  const model = constants.Model ?? "";
  const name = `${brand.charAt(0).toUpperCase()}${brand.slice(1)} ${model}`.trim();
  // i18n-ignore: stored by the server as the device's name; unnamed devices are an open follow-up (spec §6 #4)
  return name || "Điện thoại";
}

let deviceIdPromise: Promise<string | null> | null = null;

/**
 * This install's device id: a random UUID made on first use and kept in
 * SecureStore. The backend binds every session to it (mig 033), so one phone
 * holds one session per account and the account's owner can sign this phone
 * out from another one. Not a secret — it only groups this phone's sessions in
 * the owner's own device list — and not crypto-grade for the same reason.
 * Reinstalling the app makes a new one.
 *
 * null when secure storage fails: the request then says nothing about its
 * device, which the server accepts.
 */
export function getDeviceId(): Promise<string | null> {
  deviceIdPromise ??= loadOrCreateDeviceId();
  return deviceIdPromise;
}

async function loadOrCreateDeviceId(): Promise<string | null> {
  try {
    const stored = await secureStorage.getItem(SECURE_STORE_DEVICE_ID_KEY);
    if (stored) return stored;
    const created = newIdempotencyKey();
    await secureStorage.setItem(SECURE_STORE_DEVICE_ID_KEY, created);
    return created;
  } catch {
    // Try again on the next request rather than never.
    deviceIdPromise = null;
    return null;
  }
}

/**
 * Request interceptor for every client that talks to the backend (apiClient,
 * the refresh client, the account-switch client): says which device the
 * request comes from. The name is URI-encoded because OkHttp refuses
 * non-ASCII header values; the server decodes it.
 */
export async function withDeviceHeaders(config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> {
  const id = await getDeviceId();
  if (id) {
    config.headers.set(HEADER_DEVICE_ID, id);
    config.headers.set(HEADER_DEVICE_NAME, encodeURIComponent(deviceName()));
  }
  return config;
}
