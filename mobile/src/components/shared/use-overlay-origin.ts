import { useEffect, useRef, useState } from "react";
import { View } from "react-native";

// How long after opening the overlay keeps re-checking where its host sits —
// past a screen push (native-stack fade) and the safe-area padding landing.
const ANCHOR_SETTLE_MS = 800;

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

  const measureAnchor = () => {
    anchorRef.current?.measureInWindow((x, y) => {
      setOrigin((prev) => (prev.x === x && prev.y === y ? prev : { x, y }));
    });
  };

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

  return { anchorRef, origin, measureAnchor };
}
