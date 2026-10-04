import { Modal, View } from "react-native";

import { withAlpha } from "@/lib/color";
import { createStyles } from "@/lib/theme";

interface BusyOverlayProps {
  visible: boolean;
  testID?: string;
}

// Dims the app enough to read as "busy, hands off", not so much that the
// triggering control's own spinner — the only progress shown — is lost under it.
const OVERLAY_ALPHA = 0.55;

/**
 * Full-screen input blocker for an operation that must not be interrupted
 * (logout, account switch — spec AC-12/EC-07). A Modal, not an absolute
 * View: it has to cover the bottom nav too, which no screen owns. Back does
 * nothing while it is up: the operation cannot be cancelled half-way.
 */
export function BusyOverlay({ visible, testID }: BusyOverlayProps) {
  const styles = useStyles();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.overlay} testID={testID} />
    </Modal>
  );
}

const useStyles = createStyles((colors) => ({
  overlay: { flex: 1, backgroundColor: withAlpha(colors.bgApp, OVERLAY_ALPHA) },
}));
