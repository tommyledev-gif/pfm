import { Children, ReactNode, isValidElement } from "react";

import { MotionView } from "@/components/motion/MotionView";
import { EntrancePreset } from "@/components/motion/motion-tokens";

interface MotionStaggerProps {
  children: ReactNode;
  preset?: EntrancePreset;
  /** Index the first child staggers from, to continue an earlier group. */
  startIndex?: number;
  /** Extra wait before the first child, ms. */
  delay?: number;
  /** Each child slides to its new place when something above it appears or leaves. */
  animateLayout?: boolean;
}

/**
 * Wraps each child in its own MotionView, one stagger step apart, so a stack
 * of blocks enters top to bottom. Returns them as siblings (no wrapper of its
 * own), so they stay direct children of the caller's container and its `gap`
 * still spaces them.
 *
 * ⚠️ Pass only children that always draw something. A child that renders
 * null still gets a wrapper View, and the container's gap then spaces an
 * empty box. Keep those outside the group. Likewise a Fragment child is one
 * wrapper, not several: list its pieces as separate children instead.
 *
 * Plays on mount only, like MotionView: re-renders change nothing.
 */
export function MotionStagger({
  children,
  preset = "fadeUp",
  startIndex = 0,
  delay = 0,
  animateLayout = false,
}: MotionStaggerProps) {
  return (
    <>
      {Children.toArray(children).map((child, i) => (
        <MotionView
          key={isValidElement(child) ? child.key : i}
          preset={preset}
          index={startIndex + i}
          delay={delay}
          animateLayout={animateLayout}
        >
          {child}
        </MotionView>
      ))}
    </>
  );
}
