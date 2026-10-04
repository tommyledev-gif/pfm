import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { SECURITY_PREFS_STORAGE_KEY } from "@/lib/constants";

// Device-wide, not per User (specs/mobile-account-switch AC-31): shared by
// every saved account, kept across switch, logout and restart. Not a secret,
// so AsyncStorage like the theme.
interface SecurityPrefsState {
  /** Ask for fingerprint / face / screen lock before a switch (default on). */
  identityCheckEnabled: boolean;
  /** The "no screen lock" warning is shown once per device (BR-15). */
  noLockWarningShown: boolean;
  setIdentityCheckEnabled: (enabled: boolean) => void;
  markNoLockWarningShown: () => void;
}

export const useSecurityPrefsStore = create<SecurityPrefsState>()(
  persist(
    (set) => ({
      identityCheckEnabled: true,
      noLockWarningShown: false,
      setIdentityCheckEnabled: (enabled) => set({ identityCheckEnabled: enabled }),
      markNoLockWarningShown: () => set({ noLockWarningShown: true }),
    }),
    {
      name: SECURITY_PREFS_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        identityCheckEnabled: state.identityCheckEnabled,
        noLockWarningShown: state.noLockWarningShown,
      }),
    },
  ),
);
