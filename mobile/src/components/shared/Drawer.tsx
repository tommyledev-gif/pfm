import { ReactNode, useEffect } from "react";
import { BackHandler, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { colors, radii, spacing } from "@/lib/theme";
import { useKeyboardHeight } from "@/lib/use-keyboard-height";
import { useSheetStore } from "@/stores/sheet-store";

interface DrawerProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
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
export function Drawer({ visible, onClose, children }: DrawerProps) {
  const keyboardHeight = useKeyboardHeight();

  useEffect(() => {
    if (!visible) return;
    useSheetStore.getState().open();
    const backSub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => {
      useSheetStore.getState().close();
      backSub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Pressable style={[styles.backdrop, { paddingBottom: keyboardHeight }]} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.sheetTouchArea}>
          <ScrollView
            contentContainerStyle={styles.sheet}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 1000, elevation: 1000 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheetTouchArea: { maxHeight: "90%" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.hero,
    borderTopRightRadius: radii.hero,
    padding: spacing.xl,
    gap: spacing.md,
  },
});
