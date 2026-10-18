import { Text, View } from "react-native";

import { formatCurrency } from "@/lib/currency";
import { formatDateShort } from "@/lib/format-date";
import { createStyles, spacing, typography } from "@/lib/theme";
import { ProposalDuplicate } from "@/features/ai-chat/types";

// Copy fixed by the spec (specs/ai-chat-image-capture BR-09, BR-17) and the
// glossary ("Độ tin cậy thấp", "giống giao dịch").
const LOW_CONFIDENCE_LABEL = "Độ tin cậy thấp";

interface ProposalNoticesProps {
  lowConfidence: boolean;
  duplicate?: ProposalDuplicate;
  currency: string;
  testIDSuffix?: string;
}

/**
 * What the User should check on an image proposal before saving it: a
 * reading the AI was unsure about, and a saved Transaction it looks like.
 * Plain lines, not badges — they inform the Save decision, they are not the
 * card's content.
 */
export function ProposalNotices({ lowConfidence, duplicate, currency, testIDSuffix }: ProposalNoticesProps) {
  const styles = useStyles();
  if (!lowConfidence && !duplicate) return null;
  return (
    <View style={styles.container}>
      {lowConfidence ? (
        <Text style={styles.notice} testID={testIDSuffix ? `badge-low-confidence-${testIDSuffix}` : undefined}>
          {LOW_CONFIDENCE_LABEL}
        </Text>
      ) : null}
      {duplicate ? (
        <Text style={styles.notice} testID={testIDSuffix ? `txt-possible-duplicate-${testIDSuffix}` : undefined}>
          {`Giống giao dịch ${formatCurrency(duplicate.amount, currency)} ngày ${formatDateShort(duplicate.occurred_at)}`}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  container: { gap: spacing.xs },
  notice: { ...typography.caption, color: colors.mustard },
}));
