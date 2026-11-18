import { useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PillButton } from "@/components/ui/PillButton";
import { ChatMessage } from "@/features/ai-chat/types";
import { IntentionPortfolioView } from "@/features/spending-intentions/components/IntentionPortfolioView";
import { IntentionSummary } from "@/features/spending-intentions/components/IntentionSummary";
import { isDraftComplete, toInput } from "@/features/spending-intentions/intention-draft";
import { setIntentionState } from "@/features/spending-intentions/intention-message-state";
import {
  useCreateSpendingIntentionMutation,
  useDeleteSpendingIntentionMutation,
} from "@/features/spending-intentions/api/use-spending-intention-mutations";
import { useSpendingIntentionsQuery } from "@/features/spending-intentions/api/use-spending-intentions-query";
import { ConsultIntentionDraft, ConsultIntentions, IntentionItemState, SpendingIntention } from "@/features/spending-intentions/types";
import { errorText } from "@/lib/api-envelope";
import { useRequireOnline } from "@/lib/connectivity";
import { spacing, typography, createStyles } from "@/lib/theme";
import { useIntentionSheetsStore } from "@/stores/intention-sheets-store";

interface IntentionCardProps {
  messageId: string;
  data: ConsultIntentions;
  /** What became of each draft, by position (ChatMessage.intentionStates). */
  states?: ChatMessage["intentionStates"];
}

type Status = "draft" | "saved" | "removed" | "discarded";

const keyOf = (messageId: string, index: number) => `${messageId}:${index}`;

/**
 * An analysis reply of kind "intention": the things the User said they plan to
 * buy, each with the figures worked out from their own records, and what they
 * all add up to together with what is already kept. Proposals until the User
 * taps Save (nothing is kept on its own); once kept, a draft reads the live
 * intention from the list, so an edit or a delete anywhere shows here too.
 */
export function IntentionCard({ messageId, data, states }: IntentionCardProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const requireOnline = useRequireOnline();
  const anySaved = (states ?? []).some((s) => s.state === "saved");
  const list = useSpendingIntentionsQuery({ enabled: anySaved });
  const create = useCreateSpendingIntentionMutation();

  const statusOf = (index: number): { status: Status; live?: SpendingIntention; id?: string } => {
    const entry: IntentionItemState = states?.[index] ?? {};
    const live = entry.id ? list.data?.items.find((item) => item.id === entry.id) : undefined;
    // Deleted from the list, or on another device: the card says so.
    const goneElsewhere = entry.state === "saved" && list.isSuccess && !live;
    return { status: goneElsewhere ? "removed" : (entry.state ?? "draft"), live, id: entry.id };
  };

  const pending = data.items
    .map((item, index) => ({ item, index }))
    .filter(({ item, index }) => statusOf(index).status === "draft" && isDraftComplete(item.draft));
  const settled = data.items.every((_, index) => statusOf(index).status !== "draft");
  // While anything is still a proposal the portfolio is the one the sentence
  // produced; once every draft is settled it follows the live list.
  const portfolios = settled && list.data ? list.data.portfolios : data.portfolios;
  const portfolio = portfolios.find((p) => p.count >= 2);

  const saveAll = () =>
    requireOnline(async () => {
      for (const { item, index } of pending) {
        try {
          const kept = await create.mutateAsync({ ...toInput(item.draft), idempotency_key: keyOf(messageId, index) });
          setIntentionState(messageId, index, { id: kept.id, state: "saved" });
        } catch {
          return; // the error is shown under the card; what was kept stays kept
        }
      }
    });

  return (
    <View style={styles.card} testID={`card-intention-${messageId}`}>
      {data.items.map((item, index) => (
        <IntentionDraftItem
          key={keyOf(messageId, index)}
          messageId={messageId}
          index={index}
          item={item}
          status={statusOf(index).status}
          live={statusOf(index).live}
          id={statusOf(index).id}
        />
      ))}

      {data.truncated ? <Text style={styles.hint}>{t("intentions.card.truncated", { count: data.items.length })}</Text> : null}
      {data.skipped ? <Text style={styles.hint}>{t("intentions.card.skipped", { count: data.skipped })}</Text> : null}
      {create.isError ? <Text style={styles.error}>{errorText(create.error, "intentions.error.save")}</Text> : null}

      {pending.length >= 2 ? (
        <PillButton
          label={t("intentions.saveAll")}
          onPress={saveAll}
          loading={create.isPending}
          testID="btn-intention-save-all"
        />
      ) : null}

      {portfolio ? <IntentionPortfolioView portfolio={portfolio} testID={`portfolio-intention-${messageId}`} /> : null}
    </View>
  );
}

interface IntentionDraftItemProps {
  messageId: string;
  index: number;
  item: ConsultIntentionDraft;
  status: Status;
  live?: SpendingIntention;
  id?: string;
}

// One draft of the card: its summary and figures, and the buttons that act on it.
function IntentionDraftItem({ messageId, index, item, status, live, id }: IntentionDraftItemProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const requireOnline = useRequireOnline();
  const openForm = useIntentionSheetsStore((s) => s.openForm);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const create = useCreateSpendingIntentionMutation();
  const remove = useDeleteSpendingIntentionMutation();

  const shown = live ?? item.draft;
  const complete = isDraftComplete(item.draft);
  const closed = status === "removed" || status === "discarded";

  const save = () =>
    requireOnline(() =>
      create.mutate(
        { ...toInput(item.draft), idempotency_key: keyOf(messageId, index) },
        { onSuccess: (kept) => setIntentionState(messageId, index, { id: kept.id, state: "saved" }) },
      ),
    );
  const edit = () =>
    openForm(live ? { kind: "edit", item: live } : { kind: "create", draft: toInput(item.draft), messageId, itemIndex: index });
  const confirmRemove = () => {
    setConfirmDelete(false);
    if (!id) return;
    remove.mutate(id, { onSuccess: () => setIntentionState(messageId, index, { id, state: "removed" }) });
  };

  return (
    <View style={styles.item} testID={`intention-item-${messageId}-${index}`}>
      <Text style={styles.status}>{t(`intentions.card.state.${status}`)}</Text>
      <IntentionSummary item={shown} showFigures={!closed} />

      {status === "draft" && !complete ? <Text style={styles.hint}>{t("intentions.card.incomplete")}</Text> : null}
      {status === "draft" && item.month_moved ? <Text style={styles.hint}>{t("intentions.card.monthMoved")}</Text> : null}
      {!closed && complete && shown.assessment.monthly_burden === undefined ? (
        <Text style={styles.hint}>{t("intentions.card.noPriceHint")}</Text>
      ) : null}
      {create.isError ? <Text style={styles.error}>{errorText(create.error, "intentions.error.save")}</Text> : null}
      {remove.isError ? <Text style={styles.error}>{errorText(remove.error, "intentions.error.delete")}</Text> : null}

      {status === "draft" ? (
        <View style={styles.actions}>
          <PillButton
            label={t("common.action.save")}
            onPress={save}
            loading={create.isPending}
            disabled={!complete}
            testID="btn-intention-save"
            style={styles.action}
          />
          <PillButton label={t("common.action.edit")} variant="outline" onPress={edit} testID="btn-intention-edit" style={styles.action} />
          <PillButton
            label={t("common.action.discard")}
            variant="outline"
            onPress={() => setIntentionState(messageId, index, { state: "discarded" })}
            testID="btn-intention-discard"
            style={styles.action}
          />
        </View>
      ) : null}
      {status === "saved" ? (
        <View style={styles.actions}>
          <PillButton label={t("common.action.edit")} variant="outline" onPress={edit} disabled={!live} testID="btn-intention-edit" style={styles.action} />
          <PillButton
            label={t("common.action.delete")}
            variant="outline"
            onPress={() => requireOnline(() => setConfirmDelete(true))}
            disabled={!live}
            loading={remove.isPending}
            testID="btn-intention-delete"
            style={styles.action}
          />
        </View>
      ) : null}

      <ConfirmDialog
        visible={confirmDelete}
        title={t("intentions.delete.title")}
        message={t("intentions.delete.body", { title: shown.title })}
        confirmLabel={t("intentions.delete.confirm")}
        cancelLabel={t("common.action.keep")}
        onConfirm={confirmRemove}
        onCancel={() => setConfirmDelete(false)}
        loading={remove.isPending}
      />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  card: { marginTop: spacing.sm, gap: spacing.lg },
  item: { gap: spacing.sm },
  status: { ...typography.tiny, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
  hint: { ...typography.caption, color: colors.textSecondary },
  error: { ...typography.caption, color: colors.peach },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  action: { flex: 1 },
}));
