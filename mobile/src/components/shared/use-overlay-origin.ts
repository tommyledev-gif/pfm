import { useEffect, useRef, useState } from "react";
import { View } from "react-native";

// How long after opening the overlay keeps re-checking where its host sits —
// past a screen push (native-stack fade) and the safe-area padding landing.
const ANCHOR_SETTLE_MS = 800;
// The longest the open slide waits for the first measurement.
const MEASURE_FALLBACK_MS = 150;

/**
 * Where Drawer's overlay has to sit to cover the real window (split out of
 * Drawer.tsx for the 300-line cap).
 *
 * Rendering in-tree (see Drawer) means an absolutely-positioned child fills
 * its parent's *padding box*, not the window: from a padded host (Insights)
 * the sheet floated mid-screen like a dialog. So a zero-size anchor at the
 * parent's content origin is measured, and the overlay is offset by minus
 * those window coordinates and given explicit window dimensions — the real
 * screen edges, however padded the host.
 */
export function useOverlayOrigin(visible: boolean) {
  const anchorRef = useRef<View>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  // ⚠️ The first measurement has come back. The sheet holds its slide until
  // then (useDrawerMotion's `ready`): the sheet remounts on every open with
  // origin {0,0}, and measure() answers a frame or two after the sheet's own
  // layout, so on a padded host (Transactions: status bar + offline strip)
  // the whole sheet jumped a status bar's height mid-slide.
  const [measured, setMeasured] = useState(false);
  const measuredRef = useRef(false);

  // ⚠️ measure()'s page coordinates, not measureInWindow (same trap as
  // RevealableAmount): on Android edge-to-edge, measureInWindow reports y
  // below the status bar, so the overlay sat a status bar's height too low —
  // a sheet's last row and a sub-panel's footer buttons were pushed off the
  // bottom of the screen (perf audit 2026-11-03, 142 px on a Pixel 10a).
  //
  // ⚠️ A state update only for a real move (over half a pixel), and `measured`
  // only once. This runs every frame while the sheet slides up, and each
  // update re-renders the sheet: a view driven by the native driver is sent the
  // JS side's value on a re-render, so a sheet re-rendered mid-slide flickers
  // between where it is and where JS last saw it.
  const measureAnchor = () => {
    anchorRef.current?.measure((_x, _y, _width, _height, pageX, pageY) => {
      if (!Number.isFinite(pageX) || !Number.isFinite(pageY)) return;
      setOrigin((prev) => (Math.abs(prev.x - pageX) < 0.5 && Math.abs(prev.y - pageY) < 0.5 ? prev : { x: pageX, y: pageY }));
      if (!measuredRef.current) {
        measuredRef.current = true;
        setMeasured(true);
      }
    });
  };

  // Never hold the sheet for good on a measurement that does not come back.
  useEffect(() => {
    if (!visible || measured) return;
    const timer = setTimeout(() => setMeasured(true), MEASURE_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [visible, measured]);

  // ⚠️ Re-measured every frame for a moment after opening, not once: a sheet
  // opened as its screen mounts (Wallets' `create` param) measured mid-push,
  // before the safe-area padding landed, and kept the stale offset. The host
  // moves in the window, not the anchor in the host, so onLayout cannot catch
  // it. An unchanged position costs a measurement and no render.
  useEffect(() => {
    if (!visible) return;
    const until = Date.now() + ANCHOR_SETTLE_MS;
    let frame = requestAnimationFrame(function tick() {
      measureAnchor();
      if (Date.now() < until) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  return { anchorRef, origin, measured, measureAnchor };
}
