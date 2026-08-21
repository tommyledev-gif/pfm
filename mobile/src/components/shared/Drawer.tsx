import { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet } from "react-native";

import { colors, radii, spacing } from "@/lib/theme";
import { useKeyboardHeight } from "@/lib/use-keyboard-height";

interface DrawerProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}

// Reusable bottom-sheet chrome shared by every form/picker modal (Wallet/
// Category/Budget/Transaction forms, date pickers) — Modal + dimmed backdrop
// + slide-up sheet, so every modal gets the same look and the same
// tap-outside-to-dismiss behavior from one place instead of copy-pasted
// per-component. The backdrop is itself a Pressable that closes on tap; the
// inner Pressable is a no-op that exists only to swallow taps on the sheet
// content so they don't bubble up and close it (same nested-Pressable idiom
// the pre-existing DateRangePickerModal used before this component existed).
// The body is a ScrollView so long forms (or a shown keyboard) never clip
// content off-screen — capped at 90% of the modal height.
//
// Keyboard safety (SDS.md §3.2 / §12.1 Known Issues Log Item 2): the content
// container's bottom is padded by the live keyboard height via
// useKeyboardHeight(), never KeyboardAvoidingView — that API's Android
// "height" behavior has a confirmed bug where it fails to restore layout
// once the keyboard closes (facebook/react-native#22884), which is exactly
// why this hook exists instead. Padding the scrollable area past the
// keyboard's covered region is what lets RN's own built-in
// focused-TextInput-scrolls-into-view behavior actually have somewhere to
// scroll to — without the padding, the content is already as far down as it
// can go and the focused field stays hidden behind the keyboard.
export function Drawer({ visible, onClose, children }: DrawerProps) {
  const keyboardHeight = useKeyboardHeight();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.sheetTouchArea}>
          <ScrollView
            contentContainerStyle={[styles.sheet, keyboardHeight > 0 && { paddingBottom: spacing.xl + keyboardHeight }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
