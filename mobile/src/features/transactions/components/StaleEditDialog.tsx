import { Modal, Pressable, Text, View } from "react-native";

import { PillButton } from "@/components/ui/PillButton";
import { createStyles, radii, spacing, typography } from "@/lib/theme";

interface StaleEditDialogProps {
  visible: boolean;
  onLoadLatest: () => void;
  onSaveAnyway: () => void;
  // Backdrop / back button: keeps the form and its edit untouched.
  onDismiss: () => void;
  loading?: boolean;
}

const BACKDROP = "rgba(0,0,0,0.6)";
const DIALOG_MAX_WIDTH = 340;

// Spec BR-16 / AC-29: an edit made from a copy that changed elsewhere. Not
// ConfirmDialog: there the backdrop means "cancel", which here would be
// "Load latest" — discarding the User's edit by a stray tap.
export function StaleEditDialog({ visible, onLoadLatest, onSaveAnyway, onDismiss, loading }: StaleEditDialogProps) {
  const styles = useStyles();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable onPress={() => {}} style={styles.card} testID="dialog-stale-edit">
          <Text style={styles.title}>Giao dịch đã được sửa ở nơi khác</Text>
          <Text style={styles.message}>Lưu bản này sẽ thay bản kia.</Text>
          <View style={styles.actions}>
            <PillButton testID="btn-stale-load-latest" label="Tải bản mới" variant="outline" onPress={onLoadLatest} style={styles.flex} />
            <PillButton testID="btn-stale-save-anyway" label="Vẫn lưu" onPress={onSaveAnyway} loading={loading} style={styles.flex} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = createStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: BACKDROP, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  // Same card as ConfirmDialog, so the two prompts look like one family.
  card: {
    width: "100%",
    maxWidth: DIALOG_MAX_WIDTH,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.hero,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { ...typography.title, color: colors.textPrimary },
  message: { ...typography.body, color: colors.textSecondary },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  flex: { flex: 1 },
}));
