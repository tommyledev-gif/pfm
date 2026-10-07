import { ReactNode, useEffect, useRef, useState } from "react";
import { Animated, BackHandler, Dimensions, Pressable, ScrollView, View } from "react-native";

import { DrawerChildPanel } from "@/components/shared/DrawerChildPanel";
import { SheetHandle } from "@/components/shared/SheetHandle";
import { useSheetDrag } from "@/components/shared/use-sheet-drag";
import { radii, spacing, createStyles } from "@/lib/theme";
import { useKeyboardHeight } from "@/lib/use-keyboard-height";
import { useSheetStore } from "@/stores/sheet-store";

// A secondary panel that slides in from the right *over* an already-open
// Drawer — for a step that needs the full sheet to itself (searching a long
// category list, say) but must not lose the half-filled form underneath it.
// Modelled on the same pattern native filter sheets use: the parent stays
// mounted and untouched, and the panel slides back out to reveal it.
//
// Declared as a prop on Drawer rather than as a component the caller nests in
// `children` because it has to render *outside* the sheet's ScrollView (an
// absolutely-positioned child of a scrolling content container would scroll
// with it), and Drawer is the only thing that knows the overlay's real window
// geometry — see the anchor-measuring note below.
export interface DrawerChild {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  // Rendered pinned below the panel body rather than after it, so the
  // confirm/reset actions stay reachable no matter how long the list is.
  footer?: ReactNode;
}

interface DrawerProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  // Pinned below the sheet's scrolling body, same rationale as DrawerChild's.
  footer?: ReactNode;
  child?: DrawerChild;
}

// Reusable bottom-sheet chrome shared by every form/picker modal (Wallet/
// Category/Budget/Transaction forms, date pickers) — dimmed backdrop +
// slide-up sheet, so every modal gets the same look and the same
// tap-outside-to-dismiss behavior from one place instead of copy-pasted
// per-component. The backdrop is itself a Pressable that closes on tap; the
// inner Pressable is a no-op that exists only to swallow taps on the sheet
// content so they don't bubble up and close it. The body is a ScrollView so
// long forms (or a shown keyboard) never clip content off-screen — capped
// at 90% of the modal height.
//
// Keyboard safety (SDS.md §3.2 / §12.1 Known Issues Log Item 2), take two:
// this used to render through react-native's <Modal>, padding the
// ScrollView's contentContainerStyle by the live keyboard height. That
// still left the input hidden intermittently — Android hosts <Modal>'s
// content in a separate Dialog window outside the Activity's own view tree,
// and getting a focused input back into view there depends on RN's
// automatic scroll-to-focused-input firing correctly, which is exactly the
// part that's unreliable inside a Modal on Android (the "insights budget
// tab seems fine" report was luck, not a working mechanism).
//
// Fix: render as a plain absolutely-positioned View in the normal component
// tree instead of through <Modal> — no separate window, so there's nothing
// unreliable left to depend on. The whole sheet (backdrop + all) is shifted
// up by the exact live keyboard height via useKeyboardHeight(), which is
// sourced straight from OS keyboard-visibility events, not from window
// resize — deliberately not relying on `app.json`'s
// `android.softwareKeyboardLayoutMode: "resize"`, since Android disregards
// that flag once the app opts into edge-to-edge (Expo's default on modern
// Android targetSdk levels), which this app does. Never KeyboardAvoidingView
// either — that API's Android "height" behavior has a confirmed bug where it
// fails to restore layout once the keyboard closes (facebook/react-
// native#22884), which is exactly the "stuck pushed up after closing the
// keyboard" symptom useKeyboardHeight replaced it for in the first place.
//
// Losing <Modal> also loses two things it gave for free, both handled here:
// the Android hardware back button closing the sheet (BackHandler below),
// and always painting above everything else on screen — BottomNav
// (app/(app)/_layout.tsx) is an absolutely-positioned overlay from a
// completely different part of the tree, so a plain in-tree zIndex can't
// guarantee it stays under the sheet. useSheetStore's open/close instead
// tells the layout to hide BottomNav entirely while any Drawer is visible.
// Slide-up distance just needs to clear the screen entirely, not match the
// sheet's actual (variable, content-dependent) height — translating by the
// full window height guarantees the sheet starts below the visible area
// regardless of device size or how tall `children` ends up being.
const OFFSCREEN_Y = Dimensions.get("window").height;
// How long after opening the overlay keeps re-checking where its host sits —
// past a screen push (native-stack fade) and the safe-area padding landing.
const ANCHOR_SETTLE_MS = 800;

export function Drawer({ visible, onClose, children, footer, child }: DrawerProps) {
  const styles = useStyles();
  const keyboardHeight = useKeyboardHeight();
  // Kept mounted for the duration of the close animation — flipping
  // straight to `if (!visible) return null` would unmount mid-slide-down
  // and make the sheet vanish instantly instead of animating out.
  const [rendered, setRendered] = useState(visible);
  const translateY = useRef(new Animated.Value(visible ? 0 : OFFSCREEN_Y)).current;
  const backdropOpacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  // Grab-handle drag: down past half the height closes, up expands to max.
  const drag = useSheetDrag({ translateY, onClose });
  const { collapse } = drag;

  // Rendering in-tree (rather than through <Modal>, see the note above) has
  // one consequence the original version missed: an absolutely-positioned
  // child fills its parent's *padding box*, not the window. Mounted from a
  // screen that pads its own root — Insights does (`paddingHorizontal:
  // spacing.xl` on the Screen, `paddingBottom: 140` on the tab body) — the
  // "full-screen" overlay was inset on all four sides, so the sheet floated
  // as a rounded card in the middle of the screen and read as a dialog
  // rather than a bottom sheet. Transactions, which mounts its Drawer as a
  // direct child of an unpadded Screen, looked correct by luck.
  //
  // Fix: measure a zero-size anchor pinned at the parent's content origin,
  // then offset the overlay by the negative of those window coordinates and
  // give it explicit window dimensions — so the sheet reaches the real
  // screen edges no matter how padded (or nested) its host happens to be.
  const anchorRef = useRef<View>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const windowSize = Dimensions.get("window");

  const measureAnchor = () => {
    anchorRef.current?.measureInWindow((x, y) => {
      setOrigin((prev) => (prev.x === x && prev.y === y ? prev : { x, y }));
    });
  };

  useEffect(() => {
    if (visible) {
      setRendered(true);
      // An anchor already laid out (reopening without remounting) won't fire
      // onLayout again — the settle loop below measures it instead.
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, mass: 0.9, stiffness: 200 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: OFFSCREEN_Y, duration: 220, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (!finished) return;
        setRendered(false);
        // Every open starts at the resting height, not wherever it was left.
        collapse();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ⚠️ Re-measured every frame for a moment after opening, not once. A sheet
  // opened the instant its screen mounts (Wallets' `create` param, sent by
  // every "create a wallet first" prompt) measured while that screen was
  // still settling — mid-push, before its safe-area padding landed — and kept
  // the stale offset: the status-bar strip stayed uncovered at the top, and
  // the sheet's bottom ran off-screen by the same amount. The anchor's own
  // onLayout cannot catch this: the anchor never moves inside its host; the
  // host moves in the window. setOrigin ignores an unchanged position, so a
  // settled screen costs one measurement per frame and no renders.
  useEffect(() => {
    if (!visible) return;
    const until = Date.now() + ANCHOR_SETTLE_MS;
    let frame = requestAnimationFrame(function tick() {
      measureAnchor();
      if (Date.now() < until) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  // `child` is read through a ref inside the back handler so the subscription
  // doesn't have to be torn down and rebuilt every time the child panel opens
  // or closes.
  const childRef = useRef(child);
  childRef.current = child;

  useEffect(() => {
    if (!visible) return;
    useSheetStore.getState().open();
    const backSub = BackHandler.addEventListener("hardwareBackPress", () => {
      // Back closes the child panel first when one is open — dismissing the
      // whole sheet from inside a sub-step would throw away the parent form.
      const openChild = childRef.current;
      if (openChild?.visible) openChild.onClose();
      else onClose();
      return true;
    });
    return () => {
      useSheetStore.getState().close();
      backSub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!rendered) return null;

  return (
    <>
      {/* Zero-size, never-moved probe at the host's content origin — the
          overlay below is positioned relative to what this measures. */}
      <View ref={anchorRef} onLayout={measureAnchor} pointerEvents="none" style={styles.anchor} />
      <Animated.View
        style={[
          styles.overlay,
          { left: -origin.x, top: -origin.y, width: windowSize.width, height: windowSize.height },
          { opacity: backdropOpacity },
        ]}
      >
        <Pressable style={[styles.backdrop, { paddingBottom: keyboardHeight }]} onPress={onClose}>
          <Animated.View
            style={[
              styles.sheetTouchArea,
              drag.expanded && styles.sheetTouchAreaExpanded,
              { transform: [{ translateY }] },
            ]}
          >
            <Pressable
              onPress={() => {}}
              onLayout={drag.onSheetLayout}
              style={[styles.sheetSurface, drag.expanded && styles.sheetSurfaceExpanded]}
            >
              <SheetHandle panHandlers={drag.panHandlers} />
              <ScrollView
                // flexShrink so a pinned footer can claim its space out of the
                // scroll area once the sheet hits its 90% cap, rather than
                // being pushed off the bottom of the screen by it.
                style={[styles.sheetScroll, drag.expanded && styles.sheetScrollExpanded]}
                contentContainerStyle={styles.sheet}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
              {footer ? <View style={styles.footer}>{footer}</View> : null}
            </Pressable>
          </Animated.View>
        </Pressable>
        {child ? <DrawerChildPanel {...child} width={windowSize.width} bottomInset={keyboardHeight} /> : null}
      </Animated.View>
    </>
  );
}

const useStyles = createStyles((colors) => ({
  anchor: { position: "absolute", left: 0, top: 0, width: 0, height: 0 },
  overlay: { position: "absolute", zIndex: 1000, elevation: 1000 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheetTouchArea: { maxHeight: "90%" },
  // Dragged up via the handle: fills to the max height regardless of how
  // short the content is, with the scroll area taking the extra room so a
  // pinned footer stays at the bottom.
  sheetTouchAreaExpanded: { height: "94%", maxHeight: "94%" },
  sheetSurfaceExpanded: { flex: 1 },
  sheetScrollExpanded: { flex: 1 },
  // The surface (background + rounded top) moved off the ScrollView's content
  // container and onto this wrapper once a pinned footer joined it — the
  // footer sits outside the scroll view and would otherwise have had to
  // re-declare the same background to avoid showing the backdrop through it.
  sheetSurface: {
    flexShrink: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.hero,
    borderTopRightRadius: radii.hero,
    overflow: "hidden",
  },
  sheetScroll: { flexGrow: 0, flexShrink: 1 },
  // Top padding is small because SheetHandle's strip already sits above it.
  sheet: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, paddingTop: spacing.sm, gap: spacing.md },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
}));
