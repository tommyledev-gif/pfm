import { useEffect, useState } from "react";

import { useLatestCallback } from "@/lib/use-latest-callback";

interface StepperState {
  /** The matched messages' ids, newest first (searchChat's order). */
  ids: string[];
  index: number;
}

/**
 * After a search result is picked: the other matches of that search, one tap
 * apart (ChatSearchStepper), so going through five results is not five trips
 * back into the search. Only when there was more than one match.
 *
 * Put away when a new search opens (its own results take over) and when the
 * screen shows the other pane, whose thread the ids are not in.
 */
export function useSearchStepper(
  onJump: (messageId: string) => void,
  { searching, pane }: { searching: boolean; pane: string },
) {
  const [state, setState] = useState<StepperState | null>(null);
  useEffect(() => {
    if (searching) setState(null);
  }, [searching]);
  useEffect(() => setState(null), [pane]);

  const start = useLatestCallback((ids: string[], pickedId: string) => {
    const index = ids.indexOf(pickedId);
    setState(ids.length > 1 && index !== -1 ? { ids, index } : null);
  });

  // +1 is one older (up the thread), -1 one newer.
  const step = useLatestCallback((delta: 1 | -1) => {
    if (!state) return;
    const index = state.index + delta;
    if (index < 0 || index >= state.ids.length) return;
    setState({ ...state, index });
    onJump(state.ids[index]);
  });

  const stop = useLatestCallback(() => setState(null));

  return {
    active: state !== null,
    /** 1-based, newest first: what the counter shows. */
    position: state ? state.index + 1 : 0,
    count: state?.ids.length ?? 0,
    start,
    older: () => step(1),
    newer: () => step(-1),
    stop,
  };
}
