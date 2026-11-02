import { useCallback, useMemo, useState } from "react";

import {
  FixedCostItem,
  formatFixedCostsText,
  mergeFixedCosts,
  parseFixedCosts,
  scaleFixedCosts,
  totalFixedCosts,
} from "@/features/budget-wizard/fixed-costs";

/** What the helper sheet hands back when the user confirms it. */
export interface FixedCostsResult {
  items: FixedCostItem[];
  text: string;
  suggested: FixedCostItem[];
}

/** The subset of a saved plan this slice restores. */
export interface FixedCostsSnapshot {
  fixed: number;
  text: string;
  suggested: FixedCostItem[];
}

/**
 * The "chi phí cố định" field and the itemised breakdown behind it.
 *
 * Split out of useBudgetWizardState both to keep that hook inside the 300-line
 * limit (CLAUDE.md) and because this is a genuinely separable thing: one number
 * the user can set directly, plus a list that must always add up to it.
 */
export function useWizardFixedCosts() {
  /** xu. */
  const [fixed, setFixed] = useState(0);
  // The helper's own working state, kept out here so reopening it resumes where
  // the user left off instead of asking them to describe everything again.
  const [text, setText] = useState("");
  const [suggested, setSuggested] = useState<FixedCostItem[]>([]);
  // Owned here rather than inside the step so the panel can render as a sibling
  // of the whole wizard and cover its progress header too — a full-screen sheet
  // that leaves the step chrome showing reads as a layer that failed to open.
  const [open, setOpen] = useState(false);
  // The total the stored breakdown adds up to, as of the last confirm. It is
  // what `fixed` is compared against to tell whether the user has since moved
  // the total by hand.
  const [baseTotal, setBaseTotal] = useState(0);
  // True for exactly one opening of the helper: the sheet says the items were
  // re-spread, then stops saying it.
  const [rescaled, setRescaled] = useState(false);

  /**
   * ⚠️ The breakdown is re-spread HERE, at the moment the helper opens, and
   * nowhere else.
   *
   * Once the helper has run, "chi phí cố định" is a total with an itemised list
   * behind it. Dragging the slider afterwards moves the total and leaves the
   * list describing a different number — the field says 15tr while its own hint
   * lists costs adding up to 12tr. Scaling every item by the same factor keeps
   * both true and keeps the user's work; see scaleFixedCosts.
   *
   * Doing it on the slider's onChange instead would re-parse the text, merge,
   * scale and re-serialise the whole list on every gesture frame, to produce a
   * value nothing on screen reads until this sheet is opened. Opening it is the
   * only moment the answer is needed, so it is the only moment it is computed.
   *
   * A total dragged to zero is left alone: scaling to it would wipe every
   * figure the user typed, and "I cleared the field" is not "every one of my
   * costs is now free".
   */
  const openHelper = useCallback(() => {
    if (baseTotal > 0 && fixed > 0 && fixed !== baseTotal) {
      const scaled = scaleFixedCosts(mergeFixedCosts(parseFixedCosts(text), suggested), fixed);
      setText(formatFixedCostsText(scaled.filter((item) => item.source === "typed")));
      setSuggested(scaled.filter((item) => item.source === "suggested"));
      setBaseTotal(fixed);
      setRescaled(true);
    } else {
      setRescaled(false);
    }
    setOpen(true);
  }, [baseTotal, fixed, text, suggested]);

  const closeHelper = useCallback(() => setOpen(false), []);

  /**
   * The itemised costs behind the total, as the result screen lists them.
   *
   * Re-spread across the current total the same way openHelper does, so the
   * items always add up to the figure printed above them, even after the
   * slider moved it. Empty when the total was only ever set directly, or
   * dragged to zero.
   */
  const items = useMemo(
    () => (fixed > 0 ? scaleFixedCosts(mergeFixedCosts(parseFixedCosts(text), suggested), fixed) : []),
    [fixed, text, suggested],
  );

  /**
   * One action, not three call sites: the breakdown and the total it implies
   * must never be set separately, or the field can show a total that its own
   * itemised list does not add up to.
   */
  const apply = useCallback((result: FixedCostsResult) => {
    const total = totalFixedCosts(result.items);
    setText(result.text);
    setSuggested(result.suggested);
    setFixed(total);
    // The new baseline the next slider drag is measured against.
    setBaseTotal(total);
    setRescaled(false);
    setOpen(false);
  }, []);

  /** Back to empty, or to a saved plan's figures. */
  const reset = useCallback((snapshot?: FixedCostsSnapshot) => {
    setFixed(snapshot?.fixed ?? 0);
    setText(snapshot?.text ?? "");
    setSuggested(snapshot?.suggested ?? []);
    setBaseTotal(snapshot?.fixed ?? 0);
    setRescaled(false);
    setOpen(false);
  }, []);

  return { fixed, setFixed, text, suggested, items, open, rescaled, openHelper, closeHelper, apply, reset };
}
