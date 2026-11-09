import { memo, useState } from "react";
import Animated from "react-native-reanimated";

import { entrance, exit } from "@/components/motion/motion-tokens";
import { TextShimmerWave } from "@/components/shared/TextShimmerWave";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";

interface TypingIndicatorProps {
  /** What the assistant is doing, as a loading line ("Đang xem số liệu…"). */
  label: string;
  testID?: string;
}

// Spoken without the trailing "…", which screen readers read out as a word.
const spokenLabel = (label: string) => label.replace(/(…|\.\.\.)$/, "");

/**
 * AI Chat's "the assistant is answering" row: an assistant bubble (the same
 * box ChatBubble draws for a reply) holding a short status line with a wave
 * running through it. Rises in as it appears and fades out when the answer
 * takes its place.
 */
export const TypingIndicator = memo(function TypingIndicator({ label, testID }: TypingIndicatorProps) {
  const colors = useColors();
  const styles = useStyles();
  // Built once: a new exit builder per render re-registers the animation.
  const [motion] = useState(() => ({ entering: entrance("fadeUp"), exiting: exit("fade") }));
  return (
    <Animated.View
      testID={testID}
      entering={motion.entering}
      exiting={motion.exiting}
      style={styles.bubble}
      accessibilityLiveRegion="polite"
    >
      <TextShimmerWave
        text={label}
        style={styles.text}
        baseColor={colors.textMuted}
        highlightColor={colors.textPrimary}
        accessibilityLabel={spokenLabel(label)}
      />
    </Animated.View>
  );
});

// Mirrors ChatBubble's assistant bubble; only the line height is set, so the
// lifted letters and Vietnamese marks have room inside it.
const useStyles = createStyles((colors) => ({
  bubble: {
    // Content-sized but bounded: it hugs a short line and wraps a long one
    // inside its own edge instead of letting the letters run past it.
    alignSelf: "flex-start",
    flexShrink: 1,
    maxWidth: "82%",
    borderRadius: radii.listCard,
    borderBottomLeftRadius: 4,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  text: { ...typography.body, lineHeight: 22 },
}));
