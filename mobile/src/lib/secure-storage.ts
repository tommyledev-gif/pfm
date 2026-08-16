import * as SecureStore from "expo-secure-store";

// Thin wrapper around expo-secure-store — mirrors Flutter's
// SecureStorageService precedent (never call SecureStore directly from a
// screen/store; always through here) and flutter_secure_storage's role as
// the on-device JWT store. Unlike the Next.js web client (which never sees
// the JWT — it stays server-side behind the BFF proxy), a mobile app has no
// server tier to hide it in, so on-device secure storage is the mobile
// equivalent of that trust boundary.
export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  },
};
