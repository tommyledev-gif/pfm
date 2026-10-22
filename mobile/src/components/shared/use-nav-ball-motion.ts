import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing } from "react-native";

import {
  BOB_DISTANCE,
  BOB_DURATION,
  BOB_INPUT,
  BOB_OUTPUT,
  ICON_BOUNCE_SCALE,
} from "@/components/shared/bottom-nav-styles";

/**
 * Every animated value of the BottomNav's ball, and the three moves made
 * with them: place (first layout, no motion), reveal (fade in once placed),
 * and switchTo (a tab change). Split out of BottomNav for the 300-line cap.
 *
 * All of it runs on the native driver, and nothing here sets React state: a
 * tab switch is also the moment a new screen mounts, so anything waiting on
 * the JS thread lands frames late (see switchTo).
 */
export function useNavBallMotion(tabCount: number, startIndex: number) {
  // ⚠️ Hidden until placed: a fresh Animated.Value(0) paints the ball under
  // the first tab for a frame before the row is measured.
  const ballOpacity = useRef(new Animated.Value(0)).current;
  const ballX = useRef(new Animated.Value(0)).current;
  const squish = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const bobPhase = useRef(new Animated.Value(0)).current;
  // One opacity per tab's filled icon on the ball, all mounted at once; and
  // the row's outline icons, the active one faded out under the ball.
  const ballIconOpacities = useRef(
    Array.from({ length: tabCount }, (_, i) => new Animated.Value(i === startIndex ? 1 : 0)),
  ).current;
  const rowOpacities = useRef(
    Array.from({ length: tabCount }, (_, i) => new Animated.Value(i === startIndex ? 0 : 1)),
  ).current;

  // Idle up/down float, independent of every other animation on the ball:
  // it drives translateY only, while ballX/squish own translateX and scale,
  // so a tab switch mid-float neither interrupts nor is interrupted by it.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(bobPhase, { toValue: 1, duration: BOB_DURATION * 2, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [bobPhase]);

  // Built once: a new node per render would rebuild the native animation graph.
  const derived = useMemo(() => {
    const bob = bobPhase.interpolate({ inputRange: BOB_INPUT, outputRange: BOB_OUTPUT });
    return {
      bob,
      ballScaleX: squish.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }),
      ballScaleY: squish.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] }),
      ballBobY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -BOB_DISTANCE] }),
      bandCoverOpacity: ballOpacity.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
      followBall: { transform: [{ translateX: ballX }] },
    };
  }, [bobPhase, squish, ballOpacity, ballX]);

  const place = (index: number, x: number) => {
    ballX.setValue(x);
    ballIconOpacities.forEach((opacity, i) => opacity.setValue(i === index ? 1 : 0));
    rowOpacities.forEach((opacity, i) => opacity.setValue(i === index ? 0 : 1));
  };

  const reveal = () => Animated.timing(ballOpacity, { toValue: 1, duration: 120, useNativeDriver: true }).start();

  /**
   * Ball to `x`, icons to tab `index`.
   *
   * ⚠️ The icon swap is a cross-fade between icons that are all already
   * mounted. It used to fade the one icon out, set React state to swap it,
   * and fade it back in from the completion callback — but the fade-in ran
   * natively at once while the state change waited on the busy JS thread, so
   * the previous tab's icon came back on the ball at its new spot for a few
   * frames before the swap: the flash on a tab switch.
   *
   * Every icon is sent to its resting state, not just the two involved, so a
   * switch landing mid-way through the last one leaves nothing half faded.
   */
  const switchTo = (index: number, x: number) => {
    Animated.spring(ballX, { toValue: x, tension: 210, friction: 14, useNativeDriver: true }).start();
    squish.setValue(0);
    Animated.sequence([
      Animated.timing(squish, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.spring(squish, { toValue: 0, tension: 180, friction: 10, useNativeDriver: true }),
    ]).start();

    ballIconOpacities.forEach((opacity, i) =>
      Animated.timing(opacity, {
        toValue: i === index ? 1 : 0,
        duration: i === index ? 180 : 120,
        delay: i === index ? 60 : 0,
        useNativeDriver: true,
      }).start(),
    );
    rowOpacities.forEach((opacity, i) =>
      Animated.timing(opacity, {
        toValue: i === index ? 0 : 1,
        duration: i === index ? 160 : 220,
        useNativeDriver: true,
      }).start(),
    );
    // The new icon arrives with a small pop (1 → 1.15 → 1) so the switch
    // registers as a response to the tap, not just a swap.
    iconScale.setValue(1);
    Animated.sequence([
      Animated.delay(60),
      Animated.timing(iconScale, {
        toValue: ICON_BOUNCE_SCALE,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(iconScale, { toValue: 1, tension: 220, friction: 7, useNativeDriver: true }),
    ]).start();
  };

  return { ballOpacity, ballX, iconScale, ballIconOpacities, rowOpacities, ...derived, place, reveal, switchTo };
}
