import { create } from "zustand";

/** A target's box in screen coordinates — `measure()`'s pageX/pageY plus its size. */
export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type TooltipContent =
  /** The exact amount behind a shortened one (RevealableAmount). */
  | { kind: "amount"; amountCents: number; currency: string; label?: string }
  /** A few words on what a small icon button does (useHintTooltip). */
  | { kind: "hint"; text: string };

interface TooltipState {
  anchor: AnchorRect | null;
  content: TooltipContent | null;
  /** Bumped per show, so a new tooltip re-measures its bubble. */
  token: number;
  show: (anchor: AnchorRect, content: TooltipContent) => void;
  hide: () => void;
}

// The one tooltip on screen, drawn by TooltipHost (app/_layout.tsx) above
// everything. Ephemeral, never persisted.
export const useTooltipStore = create<TooltipState>((set) => ({
  anchor: null,
  content: null,
  token: 0,
  show: (anchor, content) => set((s) => ({ anchor, content, token: s.token + 1 })),
  hide: () => set({ anchor: null, content: null }),
}));
