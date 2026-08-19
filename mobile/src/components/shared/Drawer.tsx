import { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet } from "react-native";

import { colors, radii, spacing } from "@/lib/theme";

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
export function Drawer({ visible, onClose, children }: DrawerProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
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
