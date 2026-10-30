import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";

import { ImageIcon } from "@/components/ui/Icon";
import { ImageViewerModal } from "@/features/ai-chat/components/ImageViewerModal";
import { captureExists } from "@/features/ai-chat/image-capture";
import { ImageCapture } from "@/features/ai-chat/types";
import { createStyles, radii, spacing, typography, useColors } from "@/lib/theme";

const THUMBNAIL_SIZE = 160;
const PLACEHOLDER_ICON_SIZE = 18;

interface ImageThumbnailProps {
  capture: ImageCapture;
  messageId: string;
}

/**
 * The photo inside the User's own image message. On another device, after a
 * reinstall, or once the cache is cleared, the photo is not here: a quiet
 * placeholder instead of a broken image (specs/ai-chat-image-capture AC-24, AC-25).
 */
export function ImageThumbnail({ capture, messageId }: ImageThumbnailProps) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const [viewerOpen, setViewerOpen] = useState(false);
  const uri = capture.localUri;

  if (!uri || !captureExists(uri)) {
    return (
      <View style={styles.placeholder} testID={`img-chat-thumbnail-placeholder-${messageId}`}>
        <ImageIcon size={PLACEHOLDER_ICON_SIZE} color={colors.onGreen} />
        <Text style={styles.placeholderLabel}>{t("chat.image.placeholder")}</Text>
      </View>
    );
  }

  return (
    <>
      <Pressable accessibilityRole="imagebutton" accessibilityLabel={t("chat.image.view.a11y")} onPress={() => setViewerOpen(true)}>
        <Image testID={`img-chat-thumbnail-${messageId}`} source={{ uri }} style={styles.thumbnail} contentFit="cover" />
      </Pressable>
      <ImageViewerModal uri={viewerOpen ? uri : null} onClose={() => setViewerOpen(false)} />
    </>
  );
}

const useStyles = createStyles((colors) => ({
  thumbnail: { width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE, borderRadius: radii.listCard, marginTop: spacing.xs },
  placeholder: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
  // The bubble's own text colour (UserBubble): white on the light theme's deep
  // green, near-black on the dark theme's neon. textMuted is the page's grey
  // and all but vanished on the gradient.
  placeholderLabel: { ...typography.caption, color: colors.onGreen },
}));
