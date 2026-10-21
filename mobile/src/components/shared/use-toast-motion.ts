import { useEffect, useMemo, useRef } from "react";
import { PanResponder } from "react-native";
import {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { PRESS_SPRING, SPRING } from "@/components/motion/motion-tokens";

export const AUTO_DISMISS_MS = 5000;
// "swipe it more than 80% of its width and continue a bit more" — the
// release threshold sits a little past 80% so a drag that merely touches
// 80% and stalls still springs back; only a drag that keeps going past it
// commits to the dismiss.
const HORIZONTAL_DISMISS_RATIO = 0.85;
const VERTICAL_DISMISS_PX = 24;
const MOVE_SLOP = 6;
// Small travel, as the rest of the app's motion: it fades in from just above
// its place rather than sliding down the whole status bar.
const ENTER_FROM_Y = -40;
const ENTER_SCALE = 0.9;
const EXIT_RISE = 56;
const EXIT_SCALE = 0.96;
const FADE_IN_MS = 180;
const FADE_OUT_MS = 200;
const SNAP_BACK_MS = 150;
// A replacement dips and springs back, so a new message reads as new without
// the card leaving.
const REPLACE_DIP = 0.95;
const REPLACE_DIP_MS = 90;
// The badge pops a beat after the card lands.
const BADGE_DELAY_MS = 90;
const BADGE_FROM = 0.3;
const BADGE_TILT_DEG = -24;
// Dragged down past its place, the card gives a little and no more.
const PULL_DOWN_RESISTANCE = 0.15;
const PULL_DOWN_MAX = 12;
// A drag released near the end of the clock still leaves time to read.
const MIN_RESUME = 0.3;
// The card fades to this much of itself as it is dragged a full width aside.
const DRAG_FADE = 0.6;

type Direction = "up" | "left" | "right";
type Phase = "hidden" | "shown" | "leaving";

interface UseToastMotionOptions {
  /** The store's token: a new one plays the entrance (or the replace bounce). */
  token: number;
  visible: boolean;
  cardWidth: number;
  reduceMotion: boolean;
  /** The exit finished for the toast with this token. */
  onHidden: (token: number) => void;
}

/**
 * The toast's motion, on the UI thread: a spring in from just above with a
 * scale and fade, the badge popping a beat later, a 5 s clock (paused while
 * dragged) that closes it, and swipe up or aside to dismiss. Reduce motion:
 * fades only, and the finger still moves the card.
 */
export function useToastMotion({ token, visible, cardWidth, reduceMotion, onHidden }: UseToastMotionOptions) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(ENTER_FROM_Y);
  const scale = useSharedValue(ENTER_SCALE);
  const opacity = useSharedValue(0);
  const badge = useSharedValue(BADGE_FROM);
  const width = useSharedValue(cardWidth);
  /** 1 → 0 over AUTO_DISMISS_MS; the close button's ring reads it. */
  const countdown = useSharedValue(1);
  const phase = useRef<Phase>("hidden");

  useEffect(() => {
    width.value = cardWidth;
  }, [cardWidth, width]);

  // PanResponder is created once and the clock's callback crosses threads, so
  // both go through this ref to reach the current render's values.
  const live = useRef({ token, reduceMotion, cardWidth, onHidden });
  live.current = { token, reduceMotion, cardWidth, onHidden };

  const api = useMemo(() => {
    const finishExit = (leavingToken: number) => {
      if (leavingToken !== live.current.token) return;
      phase.current = "hidden";
      live.current.onHidden(leavingToken);
    };

    const dismiss = (direction: Direction, velocity = 0) => {
      if (phase.current !== "shown") return;
      phase.current = "leaving";
      cancelAnimation(countdown);
      const leavingToken = live.current.token;
      const done = (finished?: boolean) => {
        "worklet";
        if (finished) scheduleOnRN(finishExit, leavingToken);
      };
      opacity.value = withTiming(0, { duration: FADE_OUT_MS }, done);
      if (live.current.reduceMotion) return;
      if (direction === "up") {
        ty.value = withSpring(Math.min(ty.value, 0) - EXIT_RISE, { ...SPRING, velocity: Math.min(velocity, 0) });
        scale.value = withTiming(EXIT_SCALE, { duration: FADE_OUT_MS });
      } else {
        const side = direction === "left" ? -1 : 1;
        tx.value = withSpring(side * live.current.cardWidth * 1.2, { ...SPRING, velocity });
      }
    };

    // Keyed by token: a clock that ran out just as a newer toast arrived
    // must not close the newer one.
    const autoDismiss = (forToken: number) => {
      if (forToken === live.current.token) dismiss("up");
    };

    const startCountdown = (from: number) => {
      const forToken = live.current.token;
      cancelAnimation(countdown);
      countdown.value = from;
      countdown.value = withTiming(0, { duration: from * AUTO_DISMISS_MS, easing: Easing.linear }, (finished) => {
        "worklet";
        if (finished) scheduleOnRN(autoDismiss, forToken);
      });
    };

    const snapBack = () => {
      if (live.current.reduceMotion) {
        tx.value = withTiming(0, { duration: SNAP_BACK_MS });
        ty.value = withTiming(0, { duration: SNAP_BACK_MS });
      } else {
        tx.value = withSpring(0, PRESS_SPRING);
        ty.value = withSpring(0, PRESS_SPRING);
        scale.value = withSpring(1, SPRING);
      }
      startCountdown(Math.max(countdown.value, MIN_RESUME));
    };

    const panResponder = PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        phase.current === "shown" && (Math.abs(g.dx) > MOVE_SLOP || Math.abs(g.dy) > MOVE_SLOP),
      onPanResponderGrant: () => {
        // The clock waits while the toast is in hand.
        cancelAnimation(countdown);
        cancelAnimation(tx);
        cancelAnimation(ty);
      },
      onPanResponderMove: (_, g) => {
        if (Math.abs(g.dy) > Math.abs(g.dx)) {
          ty.value = g.dy < 0 ? g.dy : Math.min(g.dy * PULL_DOWN_RESISTANCE, PULL_DOWN_MAX);
          tx.value = 0;
        } else {
          tx.value = g.dx;
          ty.value = 0;
        }
      },
      onPanResponderRelease: (_, g) => {
        const vertical = Math.abs(g.dy) > Math.abs(g.dx);
        if (vertical && g.dy <= -VERTICAL_DISMISS_PX) {
          dismiss("up", g.vy * 1000);
          return;
        }
        if (!vertical && Math.abs(g.dx) >= live.current.cardWidth * HORIZONTAL_DISMISS_RATIO) {
          dismiss(g.dx < 0 ? "left" : "right", g.vx * 1000);
          return;
        }
        snapBack();
      },
      onPanResponderTerminate: () => snapBack(),
    });

    return { dismiss, startCountdown, panResponder };
  }, [countdown, opacity, scale, tx, ty]);

  // Hidden without an exit of ours (nothing does that today): the next show()
  // must enter fresh, not bounce a card that is no longer there.
  useEffect(() => {
    if (visible) return;
    phase.current = "hidden";
    cancelAnimation(countdown);
    opacity.value = 0;
  }, [visible, countdown, opacity]);

  // Every show(): a fresh entrance, or, while one is up, a dip-and-settle in
  // place with the new content. Either way the clock starts over.
  useEffect(() => {
    if (!visible || token === 0) return;
    const replacing = phase.current === "shown";
    phase.current = "shown";
    [tx, ty, scale, opacity, badge].forEach((value) => cancelAnimation(value));

    if (reduceMotion) {
      tx.value = 0;
      ty.value = 0;
      scale.value = 1;
      badge.value = 1;
      opacity.value = withTiming(1, { duration: FADE_IN_MS });
    } else if (replacing) {
      tx.value = withSpring(0, SPRING);
      ty.value = withSpring(0, SPRING);
      scale.value = withSequence(withTiming(REPLACE_DIP, { duration: REPLACE_DIP_MS }), withSpring(1, PRESS_SPRING));
      opacity.value = withTiming(1, { duration: FADE_IN_MS });
      badge.value = BADGE_FROM;
      badge.value = withDelay(BADGE_DELAY_MS, withSpring(1, PRESS_SPRING));
    } else {
      tx.value = 0;
      ty.value = ENTER_FROM_Y;
      scale.value = ENTER_SCALE;
      opacity.value = 0;
      badge.value = BADGE_FROM;
      ty.value = withSpring(0, SPRING);
      scale.value = withSpring(1, SPRING);
      opacity.value = withTiming(1, { duration: FADE_IN_MS });
      badge.value = withDelay(BADGE_DELAY_MS, withSpring(1, PRESS_SPRING));
    }
    api.startCountdown(1);
    // Keyed on the token alone: a theme or width change must not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => () => cancelAnimation(countdown), [countdown]);

  const cardStyle = useAnimatedStyle(() => {
    const drift = Math.min(Math.abs(tx.value) / Math.max(width.value, 1), 1);
    return {
      opacity: opacity.value * (1 - drift * DRAG_FADE),
      transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
    };
  });

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badge.value }, { rotate: `${(1 - badge.value) * BADGE_TILT_DEG}deg` }],
  }));

  return { cardStyle, badgeStyle, countdown, panHandlers: api.panResponder.panHandlers, dismiss: api.dismiss };
}
