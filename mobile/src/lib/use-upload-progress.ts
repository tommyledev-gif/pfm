import { useEffect, useRef, useState } from "react";
import type { MutationStatus } from "@tanstack/react-query";
import { Easing, cancelAnimation, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { useReduceMotion } from "@/lib/use-reduce-motion";

/**
 * idle → progress (0-99%) → waiting (the upload outlasted the staged run) →
 * done → idle. The keys double as SlideSwap slot keys.
 */
export type UploadPhase = "idle" | "progress" | "waiting" | "done";

// The run is staged, not measured: the upload endpoints report no progress.
// The bar climbs to 99% over MIN_RUN_MS and only reaches 100% once the server
// has answered, so a fast upload still plays the whole run and a slow one
// parks at 99% and says it is still uploading.
const MIN_RUN_MS = 5000;
const PROGRESS_CAP = 0.99;
const FINISH_MS = 280;
const DONE_HOLD_MS = 1400;
const FADE_MS = 240;

/**
 * Drives an upload control from its mutation's status: the phase to show, the
 * whole percent for the label, and the style for the fill behind it.
 *
 * Reduce motion skips the staged run (no climbing bar, no minimum wait): the
 * control says it is uploading until the server answers.
 */
export function useUploadProgress(status: MutationStatus) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);
  const fillOpacity = useSharedValue(0);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [percent, setPercent] = useState(0);
  const succeeded = useRef(false);
  const minRunOver = useRef(false);
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
    const reset = () => {
      clearTimers();
      succeeded.current = false;
      cancelAnimation(progress);
      progress.value = 0;
      fillOpacity.value = 0;
      setPhase("idle");
    };
    const finish = () => {
      clearTimers();
      succeeded.current = false;
      progress.value = reduceMotion ? 1 : withTiming(1, { duration: FINISH_MS });
      setPhase("done");
      later(() => {
        setPhase("idle");
        fillOpacity.value = reduceMotion ? 0 : withTiming(0, { duration: FADE_MS });
        later(() => {
          progress.value = 0;
        }, FADE_MS);
      }, DONE_HOLD_MS);
    };

    if (status === "pending") {
      clearTimers();
      succeeded.current = false;
      minRunOver.current = false;
      cancelAnimation(progress);
      progress.value = 0;
      fillOpacity.value = 1;
      if (reduceMotion) {
        setPhase("waiting");
        return;
      }
      setPhase("progress");
      progress.value = withTiming(PROGRESS_CAP, { duration: MIN_RUN_MS, easing: Easing.out(Easing.quad) });
      later(() => {
        minRunOver.current = true;
        if (succeeded.current) finish();
        else setPhase("waiting");
      }, MIN_RUN_MS);
      return;
    }
    // Only a run this hook watched start can finish: a form reopened over a
    // mutation that already succeeded stays idle.
    if (status === "success" && previous === "pending") {
      if (reduceMotion || minRunOver.current) finish();
      else succeeded.current = true;
      return;
    }
    if (status === "error" || status === "idle") reset();
  }, [status, reduceMotion, progress, fillOpacity]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
    opacity: fillOpacity.value,
  }));

  return { phase, percent, fillStyle, busy: phase !== "idle" };
}
