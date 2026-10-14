import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** An access request this device sent, waiting to become a real sign-in. */
export interface SentAccessRequest {
  email: string;
  /** ISO UTC. */
  sentAt: string;
}

interface AccessRequestState {
  requests: SentAccessRequest[];
  /** Remembers a request the server just took; one entry per email. */
  add: (email: string) => void;
  /** Gone from the device: "Gỡ khỏi thiết bị", or signed in with it. */
  remove: (email: string) => void;
}

const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The access requests sent from this device, so the login screen can list
 * the requester among its saved accounts, with the sign-in held until an
 * admin approves (use-access-request-status-query.ts). Device-local, like the
 * saved-account list; holds no secret, so AsyncStorage like the other
 * persisted UI stores. Dropped once that email signs in (complete-login.ts).
 */
export const useAccessRequestStore = create<AccessRequestState>()(
  persist(
    (set) => ({
      requests: [],
      add: (email) =>
        set((s) => ({
          requests: [{ email: email.trim(), sentAt: new Date().toISOString() }, ...s.requests.filter((r) => !sameEmail(r.email, email))],
        })),
      remove: (email) => set((s) => ({ requests: s.requests.filter((r) => !sameEmail(r.email, email)) })),
    }),
    { name: "pfm_access_requests", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
