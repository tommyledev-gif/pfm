import { Modal, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CloseIcon } from "@/components/ui/Icon";
import { createStyles, spacing, useColors } from "@/lib/theme";

const CLOSE_ICON_SIZE = 22;
const CLOSE_HIT_SLOP = 12;

interface ImageViewerModalProps {
  /** The photo to show full screen; closed while null. */
  uri: string | null;
  onClose: () => void;
}

/** Full-screen look at the User's own photo, to compare with the cards (AC-04). */
export function ImageViewerModal({ uri, onClose }: ImageViewerModalProps) {
  const colors = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={uri !== null} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.screen}>
        {uri ? <Image source={{ uri }} style={styles.image} contentFit="contain" /> : null}
        <Pressable
          testID="btn-close-image-viewer"
          accessibilityRole="button"
          accessibilityLabel="Đóng ảnh"
          hitSlop={CLOSE_HIT_SLOP}
          onPress={onClose}
          style={[styles.close, { top: insets.top + spacing.lg }]}
        >
          <CloseIcon size={CLOSE_ICON_SIZE} color={colors.textPrimary} />
        </Pressable>
      </View>
    </Modal>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  image: { flex: 1 },
  close: { position: "absolute", right: spacing.xl },
}));
