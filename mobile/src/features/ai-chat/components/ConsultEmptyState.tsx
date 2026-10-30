import { View, ViewProps } from "react-native";
import { useTranslation } from "react-i18next";

import { EmptyIllustration } from "@/components/shared/EmptyIllustration";
import { EmptyStateCard } from "@/components/shared/EmptyState";
import { BarChartIcon, SparkleIcon } from "@/components/ui/Icon";
import { spacing, createStyles, useColors } from "@/lib/theme";

/**
 * The analysis thread before its first question: the animated chart icon, in
 * the same card as the other empty states.
 *
 * No action and no quoted example question: an example here would look
 * tappable and is not. The tappable ones are the starter chips right above the
 * input.
 *
 * ⚠️ `style` and `onLayout` MUST reach the root view: this renders as an
 * inverted FlatList's ListEmptyComponent, and the list flips it upright by
 * cloning it with its own inversion style. Dropped, the card renders upside
 * down.
 */
export function ConsultEmptyState({ style, onLayout }: Pick<ViewProps, "style" | "onLayout">) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();

  return (
    <View style={[styles.container, style]} onLayout={onLayout} testID="empty-chat-consult">
      <EmptyStateCard
        illustration={
          <EmptyIllustration badge={<SparkleIcon size={12} color={colors.onGreen} />}>
            <BarChartIcon size={30} color={colors.green} />
          </EmptyIllustration>
        }
        title={t("chat.consult.empty.title")}
        description={t("chat.consult.empty.body")}
      />
    </View>
  );
}

const useStyles = createStyles(() => ({
  // Centred in whatever height the thread has left above the composer.
  container: { flexGrow: 1, justifyContent: "center", paddingVertical: spacing.lg },
}));
