import { useEffect, useState } from "react";
import { Modal, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PillButton } from "@/components/ui/PillButton";
import { useKeyboardHeight } from "@/lib/use-keyboard-height";
import { createStyles, radii, spacing, typography, useColors } from "@/lib/theme";

// Mirrors backend common.AIImageCaptionMaxLength (confirmed 2026-10-04).
const CAPTION_MAX_LENGTH = 300;

interface ImagePreviewModalProps {
  /** The picked photo; the modal is open while this is set. */
  uri: string | null;
  onSend: (caption: string) => void;
  onCancel: () => void;
}

/**
 * The photo as it will be sent, with an optional caption — nothing leaves the
 * device before Send (specs/ai-chat-image-capture AC-03). The caption names a
 * Wallet ("ví MB"); "Bỏ ảnh" discards the photo.
 */
export function ImagePreviewModal({ uri, onSend, onCancel }: ImagePreviewModalProps) {
  const colors = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const [caption, setCaption] = useState("");

  useEffect(() => {
    if (uri) setCaption("");
  }, [uri]);

  return (
    <Modal visible={uri !== null} animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <View style={[styles.screen, { paddingTop: insets.top + spacing.lg }]}>
        {uri ? (
          <Image
            testID="img-capture-preview"
            source={{ uri }}
            style={styles.image}
            contentFit="contain"
            accessibilityLabel="Ảnh sẽ gửi"
          />
        ) : null}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, keyboardHeight) + spacing.lg }]}>
          <TextInput
            testID="input-capture-caption"
            value={caption}
            onChangeText={setCaption}
            maxLength={CAPTION_MAX_LENGTH}
            placeholder="Chú thích, ví dụ: ví MB"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Chú thích ảnh"
            style={styles.caption}
          />
          <View style={styles.actions}>
            <PillButton label="Bỏ ảnh" variant="outline" onPress={onCancel} style={styles.action} testID="btn-cancel-image" />
            <PillButton label="Gửi ảnh" onPress={() => onSend(caption)} style={styles.action} testID="btn-send-image" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  image: { flex: 1, marginHorizontal: spacing.lg },
  footer: { gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  caption: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  actions: { flexDirection: "row", gap: spacing.md },
  action: { flex: 1 },
}));
