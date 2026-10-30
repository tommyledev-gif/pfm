import { useMemo, useState } from "react";

import { errorText, getErrorCode, isNetworkError } from "@/lib/api-envelope";
import { i18n } from "@/lib/i18n";
import { MIN_TYPING_MS } from "@/features/ai-chat/hooks/use-chat-actions";
import { nextMessageId } from "@/features/ai-chat/message-id";
import { appReply } from "@/features/ai-chat/message-text";
import { ChatMessage } from "@/features/ai-chat/types";
import { useAnalyticsQueryMutation } from "@/features/analytics/api/use-analytics-query-mutation";
import { useConsultMutation } from "@/features/analytics/api/use-consult-mutation";
import { ConsultHandlers } from "@/features/analytics/components/ConsultReplyCard";
import { STARTER_CHIPS } from "@/features/analytics/starter-chips";
import {
  AnalyticsAnswer,
  AnalyticsFollowUp,
  AnalyticsQuery,
  ConsultCategoryRef,
  ConsultResponse,
} from "@/features/analytics/types";
import { categoryLabel } from "@/features/categories/category-label";
import { Category } from "@/features/categories/types";
import { useLatestCallback } from "@/lib/use-latest-callback";
import { captureChatEpoch, useChatStore } from "@/stores/chat-store";

const RATE_LIMITED = "RATE_LIMITED";
// Ends on "Thử:" like the backend's own fallbacks — the reply's chips
// are listed right under it as tappable rows (SuggestionRows). Stored in the
// thread as keys (message-text.ts).
const LIMIT_REACHED_TEXT = "chat.consult.limitReached";
const PICK_CATEGORY_TEXT = "chat.consult.pickCategory";
const GENERIC_ERROR_TEXT = "chat.consult.error";

interface UseConsultActionsOptions {
  /** Scrolls the thread to the newest message after the user asks. */
  onSent: () => void;
  /** The User's Categories, for the "Change" picker under a banner. */
  categories: Category[];
  onSwitchToRecording: (prefill?: string) => void;
}

/**
 * Everything analysis mode does to the thread (specs/ai-chat-query-spending).
 *
 * Kept apart from use-chat-actions so the transaction-recording path is
 * untouched: a question here can never become a Transaction proposal. Chips,
 * follow-ups, Category picks and "Change" all go to /analytics/query — only
 * typed text goes to /analytics/consult, the one limited endpoint.
 */
export function useConsultActions({ onSent, categories, onSwitchToRecording }: UseConsultActionsOptions) {
  const addMessage = useChatStore((s) => s.addMessage);

  const [sending, setSending] = useState(false);

  const consult = useConsultMutation();
  const query = useAnalyticsQueryMutation();

  // One user bubble, then one reply, with the same typing pacing as the
  // transaction path. Refuses while a reply is pending (spec.md US-01 EC).
  const exchange = async (userText: string, produce: () => Promise<ChatMessage>) => {
    if (sending) return;
    addMessage({ id: nextMessageId(), role: "user", text: userText, consultQuestion: true });
    onSent();
    setSending(true);
    const stillCurrent = captureChatEpoch();
    const startedAt = Date.now();
    const reply = await produce();
    const elapsed = Date.now() - startedAt;
    if (elapsed < MIN_TYPING_MS) {
      await new Promise((resolve) => setTimeout(resolve, MIN_TYPING_MS - elapsed));
    }
    // Dropped if the session changed while the answer was on its way.
    if (stillCurrent()) addMessage({ ...reply, sourceText: userText });
    setSending(false);
  };

  const sendConsult = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    void exchange(trimmed, async () => {
      try {
        return fromConsult(await consult.mutateAsync({ message: trimmed }));
      } catch (err) {
        return errorReply(err, STARTER_CHIPS);
      }
    });
  };

  const askQuery = (q: AnalyticsQuery, label: string) => {
    void exchange(label, async () => {
      try {
        return fromAnswer(await query.mutateAsync(q));
      } catch (err) {
        // Retrying the exact question is the one chip that surely helps. The
        // chip is stored with its label, so it keeps the language it was made in.
        return errorReply(err, [{ label: i18n.t("common.action.retry"), query: q }]);
      }
    });
  };

  const pickCategory = (pending: AnalyticsQuery, category: ConsultCategoryRef) => {
    askQuery({ ...pending, category_ids: [category.id] }, category.name);
  };

  // "Change" under a medium-confidence banner: offer the User's own
  // Categories of the same type — no server call, no limit consumed.
  const changeCategories = (q: AnalyticsQuery) => {
    const type = q.tx_type ?? "expense";
    addMessage({
      id: nextMessageId(),
      role: "assistant",
      ...appReply(PICK_CATEGORY_TEXT),
      consult: {
        kind: "clarify_category",
        category_choices: categories.filter((c) => c.type === type).map((c) => ({ id: c.id, name: categoryLabel(c) })),
        pending_query: { ...q, category_ids: undefined },
        chips: [],
      },
    });
  };

  // Stable, so memoized rows re-render only when `busy` flips.
  const onAskQuery = useLatestCallback(askQuery);
  const onPickCategory = useLatestCallback(pickCategory);
  const onChangeCategories = useLatestCallback(changeCategories);
  const onSwitch = useLatestCallback(onSwitchToRecording);
  const handlers = useMemo<ConsultHandlers>(
    () => ({ onAskQuery, onPickCategory, onChangeCategories, onSwitchToRecording: onSwitch, busy: sending }),
    [onAskQuery, onPickCategory, onChangeCategories, onSwitch, sending],
  );

  return { sending, sendConsult, askQuery, handlers };
}

function fromConsult(res: ConsultResponse): ChatMessage {
  const { message, ...data } = res;
  return {
    id: nextMessageId(),
    role: "assistant",
    // An answer's bubble text is its summary; every other reply carries its
    // own explanation.
    text: res.answer ? res.answer.summary : message,
    consult: data,
  };
}

function fromAnswer(answer: AnalyticsAnswer): ChatMessage {
  return {
    id: nextMessageId(),
    role: "assistant",
    text: answer.summary,
    consult: { kind: "answer", answer, chips: answer.follow_ups },
  };
}

function errorReply(err: unknown, chips: AnalyticsFollowUp[]): ChatMessage {
  const limited = getErrorCode(err) === RATE_LIMITED;
  return {
    id: nextMessageId(),
    role: "assistant",
    ...(limited ? appReply(LIMIT_REACHED_TEXT) : failureCopy(err)),
    consult: { kind: "degraded", chips: limited ? STARTER_CHIPS : chips },
  };
}

// errorText's sentence. The generic line and the network line are stored as
// keys; a code's own sentence (errors.code.*) only as text, in today's language.
function failureCopy(err: unknown): Pick<ChatMessage, "text" | "textKey" | "textParams"> {
  if (isNetworkError(err)) return appReply("errors.network");
  const code = getErrorCode(err);
  if (code && i18n.exists(`errors.code.${code}`)) return { text: errorText(err, GENERIC_ERROR_TEXT) };
  return appReply(GENERIC_ERROR_TEXT);
}
