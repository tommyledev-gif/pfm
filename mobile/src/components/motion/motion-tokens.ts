import {
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  FadeInUp,
  FadeOut,
  FadeOutDown,
  FadeOutUp,
  LinearTransition,
  ZoomIn,
  ZoomOut,
} from "react-native-reanimated";

// The app's one motion vocabulary, modelled on animate-ui's primitives
// (https://animate-ui.com/docs/primitives): springs rather than fixed
// durations, small travel (8–16 px, never across the screen), a slight scale
// on things that appear (0.95 → 1), and lists that stagger in by a few dozen
// milliseconds per row so a screen reads top to bottom instead of all at once.
//
// Every preset goes through Reanimated's layout animations, which run on the
// UI thread and follow the OS "reduce motion" setting by themselves
// (ReduceMotion.System is their default): with it on, the content appears in
// its final place with no movement.

// ⚠️ Every spring here, and every builder or withSpring built from one,
// passes its mass. Reanimated 4 changed the default from 1 to 4: these
// dampings, tuned for 1, then ring at a quarter of their damping ratio.
// SPRING overshot by ~20% instead of none, a damping(12) tick by ~70%, and
// every entrance and layout move kept the UI thread busy ~4x longer than
// designed (2026-11-01).
/** animate-ui's default spring: quick, no visible wobble. */
export const SPRING = { stiffness: 220, damping: 26, mass: 1 } as const;
/** For an indicator that slides between options (tabs, segmented control). */
export const HIGHLIGHT_SPRING = { stiffness: 350, damping: 35, mass: 1 } as const;
/** A press: scales down fast, settles back with a hint of bounce. */
export const PRESS_SPRING = { stiffness: 420, damping: 22, mass: 0.8 } as const;

/** Delay between two rows of a staggered list. */
export const STAGGER_MS = 40;
/** Rows past this one appear together with it, so a long list never waits. */
export const STAGGER_MAX_INDEX = 8;
/** How far content travels as it appears. */
export const ENTER_OFFSET = 12;
/** Scale a press settles on. */
export const PRESS_SCALE = 0.97;

export type EntrancePreset = "fadeUp" | "fadeDown" | "fade" | "zoom" | "slideLeft" | "slideRight";

/**
 * The entering animation for a preset, `delay` ms late. Built fresh per call:
 * Reanimated's builders are mutable, so sharing one instance between views
 * would leak one view's delay into the next.
 */
export function entrance(preset: EntrancePreset = "fadeUp", delay = 0) {
  const { damping, stiffness, mass } = SPRING;
  switch (preset) {
    case "fade":
      return FadeIn.duration(220).delay(delay);
    case "fadeDown":
      return FadeInUp.withInitialValues({ opacity: 0, transform: [{ translateY: -ENTER_OFFSET }] })
        .springify()
        .damping(damping)
        .stiffness(stiffness)
        .mass(mass)
        .delay(delay);
    case "zoom":
      return ZoomIn.withInitialValues({ transform: [{ scale: 0.95 }] })
        .springify()
        .damping(damping)
        .stiffness(stiffness)
        .mass(mass)
        .delay(delay);
    case "slideLeft":
      return FadeInRight.withInitialValues({ opacity: 0, transform: [{ translateX: ENTER_OFFSET * 2 }] })
        .springify()
        .damping(damping)
        .stiffness(stiffness)
        .mass(mass)
        .delay(delay);
    case "slideRight":
      return FadeInLeft.withInitialValues({ opacity: 0, transform: [{ translateX: -ENTER_OFFSET * 2 }] })
        .springify()
        .damping(damping)
        .stiffness(stiffness)
        .mass(mass)
        .delay(delay);
    case "fadeUp":
    default:
      return FadeInDown.withInitialValues({ opacity: 0, transform: [{ translateY: ENTER_OFFSET }] })
        .springify()
        .damping(damping)
        .stiffness(stiffness)
        .mass(mass)
        .delay(delay);
  }
}

export type ExitPreset = "fade" | "fadeUp" | "fadeDown" | "zoom";

export function exit(preset: ExitPreset = "fade") {
  switch (preset) {
    case "zoom":
      return ZoomOut.duration(160);
    case "fadeUp":
      return FadeOutUp.duration(180);
    case "fadeDown":
      return FadeOutDown.duration(180);
    case "fade":
    default:
      return FadeOut.duration(160);
  }
}

/** Siblings sliding into the space a row left or took (lists, accordions). */
export const layoutSpring = () =>
  LinearTransition.springify().damping(SPRING.damping).stiffness(SPRING.stiffness).mass(SPRING.mass);

/** The stagger delay for row `index`. */
export const staggerDelay = (index: number, base = 0) => base + Math.min(index, STAGGER_MAX_INDEX) * STAGGER_MS;
