import { ReactNode, useEffect, useRef, useState } from "react";
import { Animated, BackHandler, Dimensions, Easing, Keyboard, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Reanimated, { LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { DrawerChild, DrawerChildPanel } from "@/components/shared/DrawerChildPanel";
import { SheetHandle } from "@/components/shared/SheetHandle";
import { useScrollEnd } from "@/components/shared/use-scroll-end";
import { useOverlayOrigin } from "@/components/shared/use-overlay-origin";
import { useSheetDrag } from "@/components/shared/use-sheet-drag";
import { radii, spacing, createStyles } from "@/lib/theme";
import { useKeyboardHeight } from "@/lib/use-keyboard-height";
import { useSheetStore } from "@/stores/sheet-store";

// The panel that slides in over an open sheet (Drawer's `child`).
export type { DrawerChild } from "@/components/shared/DrawerChildPanel";

interface DrawerProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  // Pinned below the sheet's scrolling body, same rationale as DrawerChild's.
  footer?: ReactNode;
  child?: DrawerChild;
  /** The body's bottom comes within reach (useScrollEnd): load the next page. */
  onEndReached?: () => void;
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
// ⚠️ Closing slides the sheet down by its own height (plus a margin), on an
// even curve, while the dim fades with it. It used to travel the whole
// window height on an ease-out in 280ms: a short sheet left the screen in
// its first few dozen ms, so a tap outside read as the sheet being cut off.
const CLOSE_MS = 320;
const CLOSE_EASING = Easing.bezier(0.25, 0.1, 0.25, 1);
const CLOSE_MARGIN = 48;
// ⚠️ Opening mirrors that: up from just below the screen's edge, critically
// damped and clamped, so it lands without passing its height. It used to come
// the whole window height on a bouncy spring: a short sheet crossed most of
// that unseen, arrived at speed and rose ~24px past its height before
// settling back — "too high, then snaps down".
const OPEN_SPRING = { stiffness: 260, damping: 32, mass: 1, overshootClamping: true, useNativeDriver: true };
// Every change of the sheet's height while open (rows landing in place of a
// skeleton, the handle's full-screen toggle, the keyboard) glides instead of
// jumping. Reanimated's, not LayoutAnimation: it takes the new frame on the
// UI thread before it is drawn, so the old height never flashes first.
const SHEET_RESIZE = LinearTransition.springify().damping(30).stiffness(260).mass(1);

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

function DrawerSheet({ visible, onClose, children, footer, child, onEndReached, startOpen, onExited }: DrawerSheetProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const keyboardHeight = useKeyboardHeight();
  // The sheet runs to the bottom edge, under the gesture bar / nav buttons;
  // the keyboard, when up, covers that strip and lifts the sheet anyway.
  const { bottom: bottomInset, top: topInset } = useSafeAreaInsets();
  const navPad = keyboardHeight > 0 ? 0 : bottomInset;
  const translateY = useRef(new Animated.Value(startOpen ? 0 : OFFSCREEN_Y)).current;
  const backdropOpacity = useRef(new Animated.Value(startOpen ? 1 : 0)).current;
  // Grab-handle drag: down past half the height closes, up expands to max.
  const drag = useSheetDrag({ translateY, onClose });
  // The sheet's last measured height: how far closing has to slide it.
  const sheetHeight = useRef(0);
  // An open waiting for the sheet's first layout: only that says how far
  // below the edge the slide starts. `slidIn`: it has started once already,
  // so a reopen mid-close goes on from where the sheet is.
  const pendingOpen = useRef(false);
  const slidIn = useRef(startOpen);
  const scrollEnd = useScrollEnd(onEndReached);

  // The overlay's offset to the real window edges (useOverlayOrigin).
  const { anchorRef, origin, measureAnchor } = useOverlayOrigin(visible);
  const windowSize = Dimensions.get("window");

  const slideIn = () => {
    pendingOpen.current = false;
    if (!slidIn.current) translateY.setValue(sheetHeight.current + CLOSE_MARGIN);
    slidIn.current = true;
    Animated.spring(translateY, { toValue: 0, ...OPEN_SPRING }).start();
  };

  useEffect(() => {
    if (visible) {
      Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      if (sheetHeight.current > 0) slideIn();
      else pendingOpen.current = true;
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: CLOSE_MS, useNativeDriver: true }),
        Animated.timing(translateY, {
          toValue: sheetHeight.current > 0 ? sheetHeight.current + CLOSE_MARGIN : OFFSCREEN_Y,
          duration: CLOSE_MS,
          easing: CLOSE_EASING,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        // Unmounting resets the drag too: every open starts at resting height.
        if (finished) onExited();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Read through a ref, so the back handler is not rebuilt per child toggle.
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
        <Pressable style={[styles.backdrop, { paddingBottom: keyboardHeight }]} onPress={onClose} accessibilityLabel={t("common.action.close")}>
          {/* The frame (height, top) glides on this one (SHEET_RESIZE); the
              slide and the drag move the one inside it. */}
          <Reanimated.View layout={SHEET_RESIZE} style={[styles.sheetTouchArea, drag.expanded && styles.sheetTouchAreaExpanded]}>
            <Animated.View style={[styles.sheetSlide, drag.expanded && styles.sheetSlideExpanded, { transform: [{ translateY }] }]}>
              {/* Under the sheet, in its colour: pulling the sheet up lifts it
                  off the bottom edge for a moment (use-sheet-drag's rubber
                  band), and a sheet gliding shorter leaves its old foot
                  uncovered for a moment (SHEET_RESIZE); this fills both. */}
              <View pointerEvents="none" style={styles.skirt} />
              <Pressable
                onPress={() => {}}
                onLayout={(event) => {
                  sheetHeight.current = event.nativeEvent.layout.height;
                  if (pendingOpen.current) slideIn();
                  drag.onSheetLayout(event);
                }}
                // Full screen reaches the very top edge, under the status bar,
                // so its own padding carries the handle clear of the bar.
                style={[styles.sheetSurface, drag.expanded && [styles.sheetSurfaceExpanded, { paddingTop: topInset }]]}
              >
                <SheetHandle panHandlers={drag.panHandlers} progress={drag.progress} expanded={drag.expanded} />
                <ScrollView
                  // flexShrink so a pinned footer can claim its space out of the
                  // scroll area once the sheet hits its 90% cap, rather than
                  // being pushed off the bottom of the screen by it.
                  style={[styles.sheetScroll, drag.expanded && styles.sheetScrollExpanded]}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  {...scrollEnd}
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
          </Reanimated.View>
        </Pressable>
        {child ? (
          <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]}>
            <DrawerChildPanel
              {...child}
              width={windowSize.width}
              bottomInset={keyboardHeight}
              expanded={drag.expanded}
              topInset={topInset}
            />
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
  backdrop: { flex: 1, justifyContent: "flex-end" },
  // Resting: never past 92%, which always clears the status bar.
  sheetTouchArea: { maxHeight: "92%" },
  // ⚠️ Dragged up via the handle: the whole screen, top edge included. It
  // used to stop under a status-bar padding on the backdrop, and with the
  // rounded corners and the handle strip under that, "full" still left a
  // strip of dimmed screen showing — about a tenth of a phone with a tall
  // status bar or a cutout. The content keeps clear of the bar through the
  // surface's own top padding instead. The scroll area takes the extra
  // room, so a pinned footer stays at the bottom.
  sheetTouchAreaExpanded: { height: "100%", maxHeight: "100%" },
  sheetSlide: { flexShrink: 1 },
  sheetSlideExpanded: { flex: 1 },
  // A whole window tall: a full-screen sheet gliding back to a short one
  // leaves nearly that much under it on the way down.
  skirt: { position: "absolute", left: 0, right: 0, top: "50%", height: OFFSCREEN_Y, backgroundColor: colors.surface },
  // Square at the top edge: nothing shows above a sheet that fills the screen.
  sheetSurfaceExpanded: { flex: 1, borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  sheetScrollExpanded: { flex: 1 },
  // The surface (background + rounded top) is on this wrapper, not the
  // ScrollView's content, so a pinned footer outside the scroll shares it.
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
