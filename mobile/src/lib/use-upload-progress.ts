import { useEffect, useRef, useState } from "react";
import type { MutationStatus } from "@tanstack/react-query";
import {
  Easing,
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { useReduceMotion } from "@/lib/use-reduce-motion";

/**
 * idle → progress (climbing; back here for the 100% finish) → waiting (no
 * answer yet after a while) → done → idle. The keys double as SlideSwap slot
 * keys.
 */
export type UploadPhase = "idle" | "progress" | "waiting" | "done";

// The run is staged, not measured: the upload endpoints report no progress.
// Like Safari's loading bar, it climbs fast, then slows and never reaches the
// end on its own. The server's answer is what takes it to 100%, right away:
// the old staged run held a finished upload until a fixed 5 s had passed, so
// the button crept through the 90s after the new picture was already showing.
const CLIMB_MS = 2400;
const CLIMB_TO = 0.9;
const CRAWL_MS = 8000;
const CRAWL_TO = 0.96;
// Without an answer by then, the label stops counting and says it is uploading.
const WAITING_AFTER_MS = 5000;
// An instant answer still gets a short sweep, so the tap visibly did something.
const MIN_RUN_MS = 600;
const FINISH_MS = 320;
// How long "100%" stays before the done label rolls in.
const FULL_HOLD_MS = 380;
const DONE_HOLD_MS = 1400;
const FADE_MS = 240;

/**
 * Drives an upload control from its mutation's status: the phase to show, the
 * whole percent for the label, the 0–1 progress itself (for a ring) and the
 * style for a fill behind the control.
 *
 * Reduce motion skips the staged run (no climbing fill, no 100% beat): the
 * control says it is uploading until the server answers.
 */
export function useUploadProgress(status: MutationStatus) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);
  const fillOpacity = useSharedValue(0);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [percent, setPercent] = useState(0);
  const startedAt = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastStatus = useRef<MutationStatus | null>(null);

  // The label follows the fill, re-rendering only when the whole number moves.
  useAnimatedReaction(
    () => Math.round(progress.value * 100),
    (now, previous) => {
      if (now !== previous) scheduleOnRN(setPercent, now);
    },
  );

  useEffect(() => {
    const previous = lastStatus.current;
    lastStatus.current = status;
    if (status === previous) return;

    const clearTimers = () => timers.current.splice(0).forEach(clearTimeout);
    const later = (fn: () => void, ms: number) => {
      timers.current.push(setTimeout(fn, ms));
    };
    const settle = (afterMs: number) => {
      later(() => {
        setPhase("idle");
        fillOpacity.value = reduceMotion ? 0 : withTiming(0, { duration: FADE_MS });
        later(() => {
          progress.value = 0;
        }, FADE_MS);
      }, afterMs);
    };
    const finish = () => {
      cancelAnimation(progress);
      if (reduceMotion) {
        progress.value = 1;
        setPhase("done");
        settle(DONE_HOLD_MS);
        return;
      }
      // Back to the count, even from "waiting", so every run ends on 100%.
      setPhase("progress");
      progress.value = withTiming(1, { duration: FINISH_MS, easing: Easing.out(Easing.cubic) });
      later(() => setPhase("done"), FINISH_MS + FULL_HOLD_MS);
      settle(FINISH_MS + FULL_HOLD_MS + DONE_HOLD_MS);
    };

    if (status === "pending") {
      clearTimers();
      startedAt.current = Date.now();
      cancelAnimation(progress);
      progress.value = 0;
      fillOpacity.value = 1;
      if (reduceMotion) {
        setPhase("waiting");
        return;
      }
      setPhase("progress");
      progress.value = withSequence(
        withTiming(CLIMB_TO, { duration: CLIMB_MS, easing: Easing.out(Easing.cubic) }),
        withTiming(CRAWL_TO, { duration: CRAWL_MS, easing: Easing.out(Easing.quad) }),
      );
      later(() => setPhase("waiting"), WAITING_AFTER_MS);
      return;
    }
    // Only a run this hook watched start can finish: a form reopened over a
    // mutation that already succeeded stays idle.
    if (status === "success" && previous === "pending") {
      clearTimers();
      const remaining = reduceMotion ? 0 : MIN_RUN_MS - (Date.now() - startedAt.current);
      if (remaining > 0) later(finish, remaining);
      else finish();
      return;
    }
    if (status === "error" || status === "idle") {
      clearTimers();
      cancelAnimation(progress);
      progress.value = 0;
      fillOpacity.value = 0;
      setPhase("idle");
    }
  }, [status, reduceMotion, progress, fillOpacity]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
    opacity: fillOpacity.value,
  }));

  return { phase, percent, progress, fillStyle, busy: phase !== "idle" };
}
