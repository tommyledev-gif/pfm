import { Text, View, ViewProps } from "react-native";

import { EmptyIllustration } from "@/components/shared/EmptyIllustration";
import { EmptyStateCard } from "@/components/shared/EmptyState";
import { Chip } from "@/components/ui/Chip";
import { SparkleIcon, WalletIcon } from "@/components/ui/Icon";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useNeedsFirstWallet, useOpenWalletCreator } from "@/features/wallets/use-open-wallet-creator";

// One of each shape the parser handles: an expense with a wallet named, a
// bare expense, and an income — tapping one fills the input, never sends.
const EXAMPLES = ["Cà phê 50k tiền mặt", "Ăn trưa 45k", "Nhận lương 15tr"];

interface RecordingEmptyStateProps extends Pick<ViewProps, "style" | "onLayout"> {
  /** Puts the example into the input, for the User to send or edit. */
  onPickExample: (text: string) => void;
}

/**
 * The recording thread before its first message.
 *
 * ⚠️ `style` and `onLayout` MUST reach the root view: this renders as an
 * inverted FlatList's ListEmptyComponent, and the list flips it upright by
 * cloning it with its own inversion style. Dropped, the card renders upside
 * down.
 */
export function RecordingEmptyState({ onPickExample, style, onLayout }: RecordingEmptyStateProps) {
  const colors = useColors();
  const styles = useStyles();
  const needsWallet = useNeedsFirstWallet();
  const openWalletCreator = useOpenWalletCreator();

  return (
    <View style={[styles.container, style]} onLayout={onLayout} testID="empty-chat-recording">
      <EmptyStateCard
        illustration={
          <EmptyIllustration size={112}>
            <SparkleIcon size={28} />
          </EmptyIllustration>
        }
        title="Ghi giao dịch bằng một câu"
        description={
          needsWallet
            ? "Bạn chưa có ví nào — giao dịch cần một ví để được lưu vào. Tạo ví trước, rồi quay lại nhắn cho mình nhé."
            : "Cho mình biết bạn đã chi hay thu gì — mình sẽ soạn sẵn giao dịch để bạn xác nhận."
        }
        action={
          needsWallet
            ? {
                label: "Tạo ví trước",
                icon: <WalletIcon size={18} color={colors.onGreen} />,
                onPress: openWalletCreator,
                testID: "btn-chat-empty-create-wallet",
              }
            : undefined
        }
      >
        {needsWallet ? null : (
          <View style={styles.examples}>
            <Text style={styles.examplesTitle}>Thử nhắn</Text>
            <View style={styles.chips}>
              {EXAMPLES.map((example) => (
                <Chip key={example} label={example} onPress={() => onPickExample(example)} />
              ))}
            </View>
          </View>
        )}
      </EmptyStateCard>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  // Centred in whatever height the thread has left above the composer.
  container: { flexGrow: 1, justifyContent: "center", paddingVertical: spacing.lg },
  examples: { alignSelf: "stretch", alignItems: "center", gap: spacing.sm },
  examplesTitle: { ...typography.caption, color: colors.textMuted },
  chips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.sm },
}));
