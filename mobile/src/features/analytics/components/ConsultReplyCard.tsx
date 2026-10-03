import { Pressable, Text, View } from "react-native";

import { CategoryBanner } from "@/features/analytics/components/CategoryBanner";
import { CategoryChoiceList } from "@/features/analytics/components/CategoryChoiceList";
import { ChartRenderer } from "@/features/analytics/components/ChartRenderer";
import { SuggestionChips } from "@/features/analytics/components/SuggestionChips";
import { SuggestionRows } from "@/features/analytics/components/SuggestionRows";
import { periodElapsed } from "@/features/analytics/period-elapsed";
import { AnalyticsPeriodInfo, AnalyticsQuery, ConsultCategoryRef, ConsultMessageData } from "@/features/analytics/types";
import { radii, spacing, typography, createStyles } from "@/lib/theme";

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

const SO_FAR_SUFFIX = " (đến hôm nay)";
// A single day that is today is still in progress — "up to now", since
// "up to today" about today says nothing (spec.md S-AIQ-49).
const SO_FAR_TODAY_SUFFIX = " (đến giờ)";

function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
}

// "28/09 (đến giờ)" for a single day, "01/09 – 30/09 (đến hôm nay)" for a range.
function periodText(period: AnalyticsPeriodInfo): string {
  const singleDay = period.from_date === period.to_date;
  const range = singleDay ? shortDate(period.from_date) : `${shortDate(period.from_date)} – ${shortDate(period.to_date)}`;
  if (!period.partial) return range;
  return range + (singleDay ? SO_FAR_TODAY_SUFFIX : SO_FAR_SUFFIX);
}

// Everything under an analysis reply's text: the answer's period and chart,
// its notices and follow-ups — or, for a reply that is not an answer, the
// Category picker, the switch-mode button or the questions to try instead.
// The reply text itself (the summary or the explanation) sits above this,
// as the message's own first line — answer first, metadata under it.
export function ConsultReplyCard({ data, handlers }: ConsultReplyCardProps) {
  const styles = useStyles();
  const answer = data.answer;
  const chips = answer ? answer.follow_ups : data.chips;

  return (
    <View testID={answer ? "card-analytics-answer" : undefined}>
      {answer ? (
        <>
          <Text testID="text-analytics-period" style={styles.period}>
            {periodText(answer.period)} · {answer.tx_count} giao dịch
          </Text>
          <ChartRenderer chart={answer.chart} currency={answer.currency} elapsed={periodElapsed(answer.period)} />
          {answer.notices.map((n) => (
            <Text key={n.code} testID={`text-analytics-notice-${n.code}`} style={styles.notice}>
              {n.message}
            </Text>
          ))}
          {data.banner_categories?.length ? (
            <CategoryBanner categories={data.banner_categories} onChange={() => handlers.onChangeCategories(answer.query)} />
          ) : null}
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

      {/* An answer's follow-ups are optional next questions — a light row of
          chips. A reply that could not answer has nothing else to offer, so
          its questions are the reply: whole tappable rows. */}
      {answer ? (
        <View style={styles.chips}>
          <SuggestionChips
            chips={chips}
            disabled={handlers.busy}
            testIDPrefix="chip-followup"
            // The thread's side padding (chatThreadStyles.thread) — same
            // edge-to-edge scroll as the starter row above the input.
            bleed={spacing.xl}
            onPress={(chip) => handlers.onAskQuery(chip.query, chip.label)}
          />
        </View>
      ) : (
        <SuggestionRows
          chips={chips}
          disabled={handlers.busy}
          testIDPrefix="chip-followup"
          onPress={(chip) => handlers.onAskQuery(chip.query, chip.label)}
        />
      )}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  period: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
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
  chips: { marginTop: spacing.md },
}));
