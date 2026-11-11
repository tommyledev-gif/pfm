import { ReactNode, useEffect, useRef, useState } from "react";
import { Animated, BackHandler, Dimensions, Keyboard, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Reanimated, { LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { DrawerChild, DrawerChildPanel } from "@/components/shared/DrawerChildPanel";
import { SheetHandle } from "@/components/shared/SheetHandle";
import { useDrawerStyles } from "@/components/shared/drawer-styles";
import { useScrollEnd } from "@/components/shared/use-scroll-end";
import { useOverlayOrigin } from "@/components/shared/use-overlay-origin";
import { useSheetDrag } from "@/components/shared/use-sheet-drag";
import { useSheetExpand } from "@/components/shared/use-sheet-expand";
import { useDrawerMotion } from "@/components/shared/use-drawer-motion";
import { radii, spacing } from "@/lib/theme";
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
  /** The close slide has finished and the sheet is gone from the screen. */
  onExited?: () => void;
  /**
   * Built with the screen and kept, hidden below the edge, while closed: an
   * open only slides it up. For a sheet opened often from one screen (the
   * Transactions FAB's form), whose build cost the open used to wait for.
   */
  keepMounted?: boolean;
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
// The slide and the dim live in useDrawerMotion, full screen in useSheetExpand.
//
// Every change of the sheet's height once it is open (rows landing in place
// of a skeleton, the keyboard) glides instead of jumping. Reanimated's, not
// LayoutAnimation: it takes the new frame on the UI thread before it is
// drawn, so the old height never flashes first. Not during the open or close
// slide (useDrawerMotion's `settled`), nor around the full-screen swap.
const SHEET_RESIZE = LinearTransition.springify().damping(30).stiffness(260).mass(1);

const claimTouch = () => true;

/**
 * Renders nothing while closed (unless `keepMounted`): the sheet and
 * everything it subscribes to (keyboard events, insets, the drag responder)
 * exist only while it is open or animating closed. Screens keep many closed
 * drawers mounted.
 */
export function Drawer(props: DrawerProps) {
  const keep = props.keepMounted ?? false;
  const [rendered, setRendered] = useState(props.visible || keep);
  // A drawer mounted already open shows in place, as before; later opens slide.
  const startOpen = useRef(props.visible);
  if ((props.visible || keep) && !rendered) setRendered(true);
  if (!rendered) return null;
  return (
    <DrawerSheet
      {...props}
      startOpen={startOpen.current}
      onExited={() => {
        startOpen.current = false;
        props.onExited?.();
        if (!keep) setRendered(false);
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
  const styles = useDrawerStyles();
  const keyboardHeight = useKeyboardHeight();
  // The sheet runs to the bottom edge, under the gesture bar / nav buttons;
  // the keyboard, when up, covers that strip and lifts the sheet anyway.
  const { bottom: bottomInset, top: topInset } = useSafeAreaInsets();
  const navPad = keyboardHeight > 0 ? 0 : bottomInset;
  // The overlay's offset to the real window edges (useOverlayOrigin); the
  // open slide waits for its first measurement.
  const { anchorRef, origin, measured, measureAnchor } = useOverlayOrigin(visible);
  // ⚠️ The nav hides as the sheet starts up, not when `visible` flips: the
  // sheet still waited for its layout, so the bar went first and the screen
  // sat a beat with neither (emulator, 2026-11-11).
  const navHidden = useRef(false);
  const releaseNav = () => {
    if (!navHidden.current) return;
    navHidden.current = false;
    useSheetStore.getState().close();
  };
  const { translateY, dimOpacity, settled, onSheetHeight } = useDrawerMotion({
    visible,
    startOpen,
    onExited: () => {
      // A kept sheet opens at resting height next time, as a new one would.
      expand.reset();
      drag.collapse();
      onExited();
    },
    ready: measured,
    onSlideStart: () => {
      if (navHidden.current) return;
      navHidden.current = true;
      useSheetStore.getState().open();
    },
  });
  // Grab-handle drag: down past half the height closes, up expands to max.
  const drag = useSheetDrag({ translateY, onClose });
  const scrollEnd = useScrollEnd(onEndReached);

  const windowSize = Dimensions.get("window");
  // What full screen fills: the backdrop above the keyboard.
  const [backdropHeight, setBackdropHeight] = useState(windowSize.height);
  const expand = useSheetExpand({
    expanded: drag.expanded,
    available: backdropHeight - keyboardHeight,
    topInset,
    cornerRadius: radii.hero,
    lift: translateY,
  });
  const { fill, shift } = expand;

  // Read through a ref, so the back handler is not rebuilt per child toggle.
  const childRef = useRef(child);
  childRef.current = child;

  useEffect(() => {
    if (!visible) return;
    const backSub = BackHandler.addEventListener("hardwareBackPress", () => {
      // Back closes the child panel first when one is open — dismissing the
      // whole sheet from inside a sub-step would throw away the parent form.
      const openChild = childRef.current;
      if (openChild?.visible) openChild.onClose();
      else onClose();
      return true;
    });
    return () => {
      releaseNav();
      backSub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  useEffect(() => releaseNav, []);

  return (
    <>
      {/* Zero-size, never-moved probe at the host's content origin — the
          overlay below is positioned relative to what this measures. */}
      <View ref={anchorRef} onLayout={measureAnchor} pointerEvents="none" style={styles.anchor} />
      <View
        style={[styles.overlay, { left: -origin.x, top: -origin.y, width: windowSize.width, height: windowSize.height }]}
        // A kept sheet waiting closed below the edge: not there for touches
        // or screen readers.
        pointerEvents={visible ? "auto" : "none"}
        importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
        accessibilityElementsHidden={!visible}
      >
        {/* ⚠️ Only the dim fades. The opacity used to sit on this whole
            overlay, sheet included, so closing faded the sheet out in 180ms
            while it was meant to be sliding down: a tap outside read as the
            sheet vanishing on the spot. */}
        <Animated.View pointerEvents="none" style={[styles.dim, { opacity: dimOpacity }]} />
        <Pressable
          style={[styles.backdrop, { paddingBottom: keyboardHeight }]}
          onPress={onClose}
          onLayout={(event) => setBackdropHeight(event.nativeEvent.layout.height)}
          accessibilityLabel={t("common.action.close")}
        >
          {/* The frame glides on this one when content changes its height
              (SHEET_RESIZE); the slide and the drag move the one inside it. */}
          <Reanimated.View
            layout={settled && !expand.holding ? SHEET_RESIZE : undefined}
            style={[styles.sheetTouchArea, fill && styles.sheetTouchAreaExpanded]}
          >
            <Animated.View style={[styles.sheetSlide, fill && styles.fill, { transform: [{ translateY }] }]}>
              {/* Under the sheet, in its colour: pulling the sheet up lifts it
                  off the bottom edge for a moment (use-sheet-drag's rubber
                  band), and a sheet gliding shorter leaves its old foot
                  uncovered for a moment (SHEET_RESIZE); this fills both. */}
              <View pointerEvents="none" style={styles.skirt} />
              <Pressable
                onPress={() => {}}
                onLayout={(event) => {
                  onSheetHeight(event.nativeEvent.layout.height);
                  drag.onSheetLayout(event);
                  expand.onSurfaceLayout(event);
                }}
                style={[styles.sheetSurface, fill && styles.fill]}
              >
                {/* Each moving layer: a plain View carrying the shift that
                    is committed with the layout swap, around an Animated.View
                    carrying only its native value (useSheetExpand). */}
                <View
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFill, fill && styles.backgroundFull, { transform: [{ translateY: shift.bg }] }]}
                >
                  <Animated.View style={[styles.background, expand.bgLayerStyle]} />
                </View>
                <View
                  style={[
                    styles.content,
                    fill && [styles.fill, { paddingTop: topInset }],
                    { transform: [{ translateY: shift.content }] },
                  ]}
                >
                  <Animated.View style={[styles.content, fill && styles.fill, expand.contentLayerStyle]}>
                    <SheetHandle panHandlers={drag.panHandlers} progress={drag.progress} expanded={drag.expanded} />
                    <ScrollView
                      // flexShrink so a pinned footer can claim its space out of
                      // the scroll area once the sheet hits its 90% cap, rather
                      // than being pushed off the bottom of the screen by it.
                      style={[styles.sheetScroll, fill && styles.sheetScrollFull]}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                      {...scrollEnd}
                    >
                      {/* ⚠️ Takes every touch nothing inside takes. Left to the
                          Pressable above, its view (Android intercepts at the JS
                          responder) swallowed the drag: the body scrolled only
                          from a button. Inside the ScrollView it can still take
                          the drag. Release dismisses the keyboard, as the
                          ScrollView would. */}
                      <View
                        style={[styles.sheet, !footer && { paddingBottom: spacing.xl + navPad }]}
                        onStartShouldSetResponder={claimTouch}
                        onResponderRelease={Keyboard.dismiss}
                      >
                        {children}
                      </View>
                    </ScrollView>
                  </Animated.View>
                </View>
                {footer ? <View style={[styles.footer, { paddingBottom: spacing.xl + navPad }]}>{footer}</View> : null}
              </Pressable>
            </Animated.View>
          </Reanimated.View>
        </Pressable>
        {child ? (
          <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { opacity: dimOpacity }]}>
            <DrawerChildPanel
              {...child}
              width={windowSize.width}
              bottomInset={keyboardHeight}
              navInset={navPad}
              expanded={drag.expanded}
              topInset={topInset}
            />
          </Animated.View>
        ) : null}
      </View>
    </>
  );
}
