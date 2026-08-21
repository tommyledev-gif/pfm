import { create } from "zustand";

// Client-only, non-persisted diagnostic log (specs/mobile-debug-console/spec.md)
// — deliberately NOT paired with TanStack Query or secure storage; this is
// ephemeral, in-memory data for the current app session only, same
// "client/global state -> Zustand" bucket as session-store.ts/chat-store.ts.
export type LogCategory = "navigation" | "api" | "error";

export interface LogEntry {
  id: number;
  timestamp: Date;
  category: LogCategory;
  summary: string;
  detail?: unknown;
}

// FIFO cap — a long-running debug session must not grow memory unboundedly
// (spec.md Business invariant).
const MAX_ENTRIES = 500;

interface DebugLogState {
  entries: LogEntry[];
  append: (category: LogCategory, summary: string, detail?: unknown) => void;
  clear: () => void;
}

let nextId = 1;

export const useDebugLogStore = create<DebugLogState>((set) => ({
  entries: [],

  append(category, summary, detail) {
    // The debug console's own logging must never crash the app it's trying
    // to help debug (spec.md Edge Case #4) — swallow anything unexpected.
    try {
      const entry: LogEntry = { id: nextId++, timestamp: new Date(), category, summary, detail };
      set((state) => {
        const next = [...state.entries, entry];
        return { entries: next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next };
      });
    } catch {
      // Swallowed intentionally — see comment above.
    }
  },

  clear() {
    set({ entries: [] });
  },
}));
