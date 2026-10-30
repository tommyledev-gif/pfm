import { Text, View, ViewProps } from "react-native";
import { useTranslation } from "react-i18next";

import { MotionStagger } from "@/components/motion/MotionStagger";
import { EmptyStateCard } from "@/components/shared/EmptyState";
import { ThemedIllustration } from "@/components/shared/ThemedIllustration";
import { Chip } from "@/components/ui/Chip";
import { WalletIcon } from "@/components/ui/Icon";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useNeedsFirstWallet, useOpenWalletCreator } from "@/features/wallets/use-open-wallet-creator";

// One of each shape the parser handles: an expense with a wallet named, a
// bare expense, and an income — tapping one fills the input, never sends.
// They are what the User sends to the parser, which reads Vietnamese only
// (specs/mobile-language-switch §6 edge case 5): Vietnamese in both languages.
const EXAMPLES = ["Cà phê 50k tiền mặt", "Ăn trưa 45k", "Nhận lương 15tr"]; // i18n-ignore
// The example chips follow the card in, one after another.
const EXAMPLES_DELAY_MS = 160;
// The robot art is nearly square: at full card width it took most of the
// thread's height and pushed the examples down behind the composer.
const AI_CHAT_ART_MAX_WIDTH = 220;

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
  const { t } = useTranslation();
  const needsWallet = useNeedsFirstWallet();
  const openWalletCreator = useOpenWalletCreator();

  return (
    <View style={[styles.container, style]} onLayout={onLayout} testID="empty-chat-recording">
      <EmptyStateCard
        illustration={<ThemedIllustration name="aiChat" maxWidth={AI_CHAT_ART_MAX_WIDTH} />}
        title={t("chat.recording.empty.title")}
        description={needsWallet ? t("common.empty.noWallet") : t("chat.recording.empty.body")}
        action={
          needsWallet
            ? {
                label: t("common.action.createWallet"),
                icon: <WalletIcon size={18} color={colors.onGreen} />,
                onPress: openWalletCreator,
                testID: "btn-chat-empty-create-wallet",
              }
            : undefined
        }
      >
        {needsWallet ? null : (
          <View style={styles.examples}>
            <Text style={styles.examplesTitle}>{t("chat.recording.examples.title")}</Text>
            <View style={styles.chips}>
              <MotionStagger delay={EXAMPLES_DELAY_MS}>
                {EXAMPLES.map((example) => (
                  <Chip key={example} label={example} onPress={() => onPickExample(example)} />
                ))}
              </MotionStagger>
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
