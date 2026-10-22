import { ReactNode, useEffect, useRef, useState } from "react";
import { Animated, BackHandler, Dimensions, Easing, Keyboard, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  // Drops the back chevron for a panel whose footer already has its exit
  // (the Items editor's "Xong"): two controls that do the same thing read as
  // two different things. Close (X) stays.
  hideBack?: boolean;
}

interface DrawerProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  // Pinned below the sheet's scrolling body, same rationale as DrawerChild's.
  footer?: ReactNode;
  child?: DrawerChild;
}

// Bottom-sheet chrome for every form and picker: dimmed backdrop that closes
// on tap, a slide-up sheet, and a ScrollView body capped at 90% height.
//
// Rendered in-tree, not through <Modal>: Android hosts a Modal in its own
// window, where scrolling a focused input into view was unreliable. The sheet
// is lifted by the live keyboard height instead (useKeyboardHeight — never
// KeyboardAvoidingView, which fails to restore layout on Android, RN#22884).
// Losing <Modal> also loses the back button and painting above BottomNav;
// BackHandler and useSheetStore (which hides the nav) cover both.
//
// Slide distance only has to clear the screen, so it is the window height.
const OFFSCREEN_Y = Dimensions.get("window").height;
// Closing glides down on a decelerating curve over a dim that fades with it,
// so a tap outside reads as the sheet sliding away, not vanishing.
const CLOSE_MS = 280;
const CLOSE_EASING = Easing.out(Easing.cubic);
// How long after opening the overlay keeps re-checking where its host sits —
// past a screen push (native-stack fade) and the safe-area padding landing.
const ANCHOR_SETTLE_MS = 800;

const claimTouch = () => true;

/**
 * Renders nothing while closed: the sheet and everything it subscribes to
 * (keyboard events, insets, the drag responder) exist only while it is open
 * or animating closed. Screens keep many closed drawers mounted.
 */
export function Drawer(props: DrawerProps) {
  const [rendered, setRendered] = useState(props.visible);
  // A drawer mounted already open shows in place, as before; later opens slide.
  const startOpen = useRef(props.visible);
  if (props.visible && !rendered) setRendered(true);
  if (!rendered) return null;
  return (
    <DrawerSheet
      {...props}
      startOpen={startOpen.current}
      onExited={() => {
        startOpen.current = false;
        setRendered(false);
      }}
    />
  );
}

interface DrawerSheetProps extends DrawerProps {
  startOpen: boolean;
  onExited: () => void;
}

function DrawerSheet({ visible, onClose, children, footer, child, startOpen, onExited }: DrawerSheetProps) {
  const styles = useStyles();
  const keyboardHeight = useKeyboardHeight();
  // The sheet runs to the screen's bottom edge (edge-to-edge), so its last
  // row would sit under the gesture bar / nav buttons without this. With the
  // keyboard up the keyboard covers that strip and lifts the sheet anyway.
  const { bottom: bottomInset, top: topInset } = useSafeAreaInsets();
  const navPad = keyboardHeight > 0 ? 0 : bottomInset;
  const translateY = useRef(new Animated.Value(startOpen ? 0 : OFFSCREEN_Y)).current;
  const backdropOpacity = useRef(new Animated.Value(startOpen ? 1 : 0)).current;
  // Grab-handle drag: down past half the height closes, up expands to max.
  const drag = useSheetDrag({ translateY, onClose });

  // Rendering in-tree (rather than through <Modal>, see the note above) means
  // an absolutely-positioned child fills its parent's *padding box*, not the
  // window. Mounted from a screen that pads its own root (Insights), the
  // "full-screen" overlay was inset on all four sides and the sheet floated
  // as a rounded card mid-screen, reading as a dialog, not a bottom sheet.
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
      // An anchor already laid out (reopening without remounting) won't fire
      // onLayout again — the settle loop below measures it instead.
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, mass: 0.9, stiffness: 200 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: CLOSE_MS, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: OFFSCREEN_Y, duration: CLOSE_MS, easing: CLOSE_EASING, useNativeDriver: true }),
      ]).start(({ finished }) => {
        // Unmounting resets the drag too: every open starts at resting height.
        if (finished) onExited();
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

  return (
    <>
      {/* Zero-size, never-moved probe at the host's content origin — the
          overlay below is positioned relative to what this measures. */}
      <View ref={anchorRef} onLayout={measureAnchor} pointerEvents="none" style={styles.anchor} />
      <View
        style={[styles.overlay, { left: -origin.x, top: -origin.y, width: windowSize.width, height: windowSize.height }]}
      >
        {/* ⚠️ Only the dim fades. The opacity used to sit on this whole
            overlay, sheet included, so closing faded the sheet out in 180ms
            while it was meant to be sliding down: a tap outside read as the
            sheet vanishing on the spot. */}
        <Animated.View pointerEvents="none" style={[styles.dim, { opacity: backdropOpacity }]} />
        <Pressable
          style={[styles.backdrop, { paddingTop: topInset, paddingBottom: keyboardHeight }]}
          onPress={onClose}
          accessibilityLabel="Đóng"
        >
          <Animated.View
            style={[
              styles.sheetTouchArea,
              drag.expanded && styles.sheetTouchAreaExpanded,
              { transform: [{ translateY }] },
            ]}
          >
            {/* Under the sheet, in its colour: pulling the sheet up lifts it
                off the bottom edge for a moment (use-sheet-drag's rubber
                band), and this keeps that gap filled. */}
            <View pointerEvents="none" style={styles.skirt} />
            <Pressable
              onPress={() => {}}
              onLayout={drag.onSheetLayout}
              style={[styles.sheetSurface, drag.expanded && styles.sheetSurfaceExpanded]}
            >
              <SheetHandle panHandlers={drag.panHandlers} progress={drag.progress} expanded={drag.expanded} />
              <ScrollView
                // flexShrink so a pinned footer can claim its space out of the
                // scroll area once the sheet hits its 90% cap, rather than
                // being pushed off the bottom of the screen by it.
                style={[styles.sheetScroll, drag.expanded && styles.sheetScrollExpanded]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* ⚠️ Takes every touch nothing inside takes. Left to the
                    Pressable above, its view (Android intercepts at the JS
                    responder) swallowed the drag: the body scrolled only from
                    a button. Inside the ScrollView it can still take the drag.
                    Release dismisses the keyboard, as the ScrollView would. */}
                <View
                  style={[styles.sheet, !footer && { paddingBottom: spacing.xl + navPad }]}
                  onStartShouldSetResponder={claimTouch}
                  onResponderRelease={Keyboard.dismiss}
                >
                  {children}
                </View>
              </ScrollView>
              {footer ? <View style={[styles.footer, { paddingBottom: spacing.xl + navPad }]}>{footer}</View> : null}
            </Pressable>
          </Animated.View>
        </Pressable>
        {child ? (
          <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]}>
            <DrawerChildPanel {...child} width={windowSize.width} bottomInset={keyboardHeight} />
          </Animated.View>
        ) : null}
      </View>
    </>
  );
}

const useStyles = createStyles((colors) => ({
  anchor: { position: "absolute", left: 0, top: 0, width: 0, height: 0 },
  overlay: { position: "absolute", zIndex: 1000, elevation: 1000 },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  // Padded by the status bar, so "full screen" stops just under it.
  backdrop: { flex: 1, justifyContent: "flex-end" },
  sheetTouchArea: { maxHeight: "92%" },
  // Dragged up via the handle: fills the whole screen under the status bar
  // regardless of how short the content is, with the scroll area taking the
  // extra room so a pinned footer stays at the bottom.
  sheetTouchAreaExpanded: { height: "100%", maxHeight: "100%" },
  skirt: { position: "absolute", left: 0, right: 0, top: "50%", height: OFFSCREEN_Y / 2, backgroundColor: colors.surface },
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
