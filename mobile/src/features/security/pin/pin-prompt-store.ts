import { create } from "zustand";

/**
 * verify: the current PIN (owner checks, turning the PIN off).
 * create: a new PIN, typed twice. change: the current one, then a new one twice.
 */
export type PinPromptKind = "verify" | "create" | "change";

export type PinPromptResult =
  | "passed"
  | "cancelled"
  /** The phone was signed out (5th wrong PIN, or "Quên mã PIN?"). */
  | "wiped"
  /** No PIN after all (unreadable record, EC-4): the caller falls back. */
  | "no-pin";

export interface PinPromptOptions {
  kind: PinPromptKind;
  /** verify only: what the PIN is for. */
  title?: string;
  /** verify only: the system prompt for fingerprint / face / screen lock; none = PIN only. */
  biometricPrompt?: string;
}

export interface PinPromptRequest extends PinPromptOptions {
  id: number;
}

interface PinPromptState {
  request: PinPromptRequest | null;
  settle: (id: number, result: PinPromptResult) => void;
}

let nextId = 1;
const waiting = new Map<number, (result: PinPromptResult) => void>();

/**
 * The PIN keypad as a promise (plan Finding #2): plain async code (the switch
 * check, the Security screen) awaits it, and <PinPromptHost /> in the root
 * layout draws it. One at a time: a new request cancels the open one.
 */
export const usePinPromptStore = create<PinPromptState>((set, get) => ({
  request: null,
  settle(id, result) {
    const resolve = waiting.get(id);
    waiting.delete(id);
    if (get().request?.id === id) set({ request: null });
    resolve?.(result);
  },
}));

export function requestPin(options: PinPromptOptions): Promise<PinPromptResult> {
  const open = usePinPromptStore.getState().request;
  if (open) usePinPromptStore.getState().settle(open.id, "cancelled");
  const id = nextId++;
  return new Promise((resolve) => {
    waiting.set(id, resolve);
    usePinPromptStore.setState({ request: { ...options, id } });
  });
}
