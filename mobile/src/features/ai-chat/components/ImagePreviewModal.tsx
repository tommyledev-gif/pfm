import { useEffect, useState } from "react";
import { Modal, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PillButton } from "@/components/ui/PillButton";
import { useKeyboardHeight } from "@/lib/use-keyboard-height";
import { createStyles, radii, spacing, typography, useColors } from "@/lib/theme";

// Mirrors backend common.AIImageCaptionMaxLength (confirmed 2026-10-04).
const CAPTION_MAX_LENGTH = 300;
// The caption goes to the parser, which reads Vietnamese only, so the example
// stays Vietnamese in both languages (specs/mobile-language-switch §6 edge case 5).
const CAPTION_EXAMPLE = "ví MB"; // i18n-ignore

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
  const { t } = useTranslation();
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
            accessibilityLabel={t("chat.image.preview.a11y")}
          />
        ) : null}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, keyboardHeight) + spacing.lg }]}>
          <TextInput
            testID="input-capture-caption"
            value={caption}
            onChangeText={setCaption}
            maxLength={CAPTION_MAX_LENGTH}
            placeholder={t("chat.image.caption.placeholder", { example: CAPTION_EXAMPLE })}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t("chat.image.caption.a11y")}
            style={styles.caption}
          />
          <View style={styles.actions}>
            <PillButton label={t("chat.image.discard")} variant="outline" onPress={onCancel} style={styles.action} testID="btn-cancel-image" />
            <PillButton label={t("chat.image.send")} onPress={() => onSend(caption)} style={styles.action} testID="btn-send-image" />
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
