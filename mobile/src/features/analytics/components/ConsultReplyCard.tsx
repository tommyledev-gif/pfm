import { Pressable, StyleSheet, Text, View } from "react-native";

import { CategoryBanner } from "@/features/analytics/components/CategoryBanner";
import { CategoryChoiceList } from "@/features/analytics/components/CategoryChoiceList";
import { ChartRenderer } from "@/features/analytics/components/ChartRenderer";
import { SuggestionChips } from "@/features/analytics/components/SuggestionChips";
import { AnalyticsQuery, ConsultCategoryRef, ConsultMessageData } from "@/features/analytics/types";
import { colors, radii, spacing, typography } from "@/lib/theme";

export interface ConsultHandlers {
  onAskQuery: (query: AnalyticsQuery, label: string) => void;
  onPickCategory: (pending: AnalyticsQuery, category: ConsultCategoryRef) => void;
  onChangeCategories: (query: AnalyticsQuery) => void;
  onSwitchToRecording: () => void;
  busy: boolean;
}

interface ConsultReplyCardProps {
  data: ConsultMessageData;
  handlers: ConsultHandlers;
}

function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
}

// Everything under an analysis reply's text: the answer's period and chart,
// its notices and follow-ups — or, for a reply that is not an answer, the
// Category picker, the switch-mode button or the fallback chips. The reply
// text itself (the summary or the explanation) is the bubble's own text.
export function ConsultReplyCard({ data, handlers }: ConsultReplyCardProps) {
  const answer = data.answer;
  const chips = answer ? answer.follow_ups : data.chips;

  return (
    <View testID={answer ? "card-analytics-answer" : undefined} style={styles.wrap}>
      {answer && data.banner_categories?.length ? (
        <CategoryBanner categories={data.banner_categories} onChange={() => handlers.onChangeCategories(answer.query)} />
      ) : null}

      {answer ? (
        <>
          <Text testID="text-analytics-period" style={styles.period}>
            {shortDate(answer.period.from_date)} – {shortDate(answer.period.to_date)}
            {answer.period.partial ? " (đến hôm nay)" : ""} · {answer.tx_count} giao dịch
          </Text>
          <ChartRenderer chart={answer.chart} currency={answer.currency} />
          {answer.notices.map((n) => (
            <Text key={n.code} testID={`text-analytics-notice-${n.code}`} style={styles.notice}>
              {n.message}
            </Text>
          ))}
        </>
      ) : null}

      {data.kind === "clarify_category" && data.category_choices && data.pending_query ? (
        <CategoryChoiceList
          choices={data.category_choices}
          disabled={handlers.busy}
          onPick={(c) => handlers.onPickCategory(data.pending_query as AnalyticsQuery, c)}
        />
      ) : null}

      {data.switch_to_recording ? (
        <Pressable testID="btn-analytics-switch-recording" style={styles.switch} onPress={handlers.onSwitchToRecording}>
          <Text style={styles.switchLabel}>Chuyển sang Ghi giao dịch</Text>
        </Pressable>
      ) : null}

      <View style={styles.chips}>
        <SuggestionChips
          chips={chips}
          disabled={handlers.busy}
          testIDPrefix="chip-followup"
          onPress={(chip) => handlers.onAskQuery(chip.query, chip.label)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.sm },
  period: { ...typography.caption, color: colors.textMuted },
  notice: { ...typography.caption, color: colors.mustardSoft, marginTop: spacing.sm },
  switch: {
    marginTop: spacing.md,
    alignSelf: "flex-start",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.green,
  },
  switchLabel: { ...typography.caption, color: colors.onGreen },
  chips: { marginTop: spacing.sm },
});
