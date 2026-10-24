import { signOutEveryAccount } from "@/features/security/pin/sign-out-device";
import { usePinStore } from "@/features/security/pin/pin-store";

export type PinEntryOutcome =
  | { kind: "right" }
  | { kind: "wrong"; triesLeft: number }
  /** The 5th wrong PIN: every account was signed out (BR-06). */
  | { kind: "wiped" }
  | { kind: "missing" }
  | { kind: "error" };

// Lets the 6th dot paint before the hash work holds the JS thread.
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 16));
}

/** Checks a typed PIN; the lock screen and the PIN prompt both go through here. */
export async function submitPin(pin: string): Promise<PinEntryOutcome> {
  await nextFrame();
  try {
    const check = await usePinStore.getState().checkPin(pin);
    if (check.result === "right") return { kind: "right" };
    if (check.result === "missing") return { kind: "missing" };
    if (check.triesLeft > 0) return { kind: "wrong", triesLeft: check.triesLeft };
  } catch {
    return { kind: "error" };
  }
  await signOutEveryAccount("wrong-pin");
  return { kind: "wiped" };
}
