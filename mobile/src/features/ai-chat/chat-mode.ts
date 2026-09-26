import type { ReactElement } from "react";
import { create } from "zustand";

import { BarChartIcon, IconProps, PlusIcon, SparkleIcon } from "@/components/ui/Icon";
import { colors } from "@/lib/theme";

/**
 * What this screen is doing with the next message the user sends.
 *
 * The chat box is one text field, but the backend already has more than one
 * thing a message could mean, and the difference between them is three words
 * wide:
 *
 *   "tiêu 50k cafe"            → record a transaction
 *   "tiêu bao nhiêu cho cafe"  → answer a question about spending
 *   "cắt cafe 50% thì sao"     → run a what-if
 *
 * Letting the model classify that on every message makes the classification
 * itself the thing that has to be right before anything else can be — and a
 * wrong guess turns a transaction the user wanted recorded into an analytics
 * answer, silently. The user picks the mode instead, so routing is never a
 * guess and never costs a model call of its own.
 */
export type ChatMode = "transaction" | "budget" | "consult";

export const DEFAULT_CHAT_MODE: ChatMode = "transaction";

/**
 * Analysis mode is built (specs/ai-chat-query-spending/): chips and
 * follow-ups call `POST /analytics/query`, typed questions
 * `POST /analytics/consult` — deliberately not under `/ai`, so asking never
 * uses up the transaction-recording limit.
 *
 * Still off until the release gate in plan.md AIQ-T46: the backend with the
 * cycle-window fix must be deployed, and the free-text golden set run
 * against the real provider (AIQ-T01/T36). Flipping this to `true` is the
 * only client-side change left.
 */
export const CONSULT_MODE_ENABLED = false;

interface ChatModeMeta {
  label: string;
  /** One line, shown under the label in the picker. */
  description: string;
  /** Placeholder for the input bar while this mode is active. */
  placeholder: string;
  icon: (props: IconProps) => ReactElement;
  /** Tints the header button and the picker's icon tile. */
  tint: string;
}

export const CHAT_MODE_META: Record<ChatMode, ChatModeMeta> = {
  transaction: {
    label: "Ghi giao dịch",
    description: "Mô tả khoản chi hoặc thu, mình soạn sẵn giao dịch cho bạn.",
    placeholder: "Mô tả một giao dịch…",
    icon: PlusIcon,
    tint: colors.green,
  },
  budget: {
    label: "Lập ngân sách",
    description: "Mở trình lập ngân sách theo thu nhập và thói quen chi tiêu.",
    placeholder: "Dùng trình lập ngân sách ở dưới…",
    icon: SparkleIcon,
    tint: colors.lavender,
  },
  consult: {
    label: "Hỏi phân tích",
    description: "Hỏi về chi tiêu, so sánh kỳ, hoặc thử một kịch bản.",
    placeholder: "Hỏi về chi tiêu của bạn…",
    icon: BarChartIcon,
    tint: colors.periwinkle,
  },
};

/** Picker order — the default mode first, the one that isn't ready last. */
export const CHAT_MODE_ORDER: ChatMode[] = ["transaction", "budget", "consult"];

export function isChatModeEnabled(mode: ChatMode): boolean {
  return mode === "consult" ? CONSULT_MODE_ENABLED : true;
}

interface ChatModeState {
  mode: ChatMode;
  setMode: (mode: ChatMode) => void;
}

/**
 * Deliberately NOT persisted, unlike the thread it sits beside in
 * `chat-store.ts`: the mode describes what the user is doing right now, and
 * reopening the app two days later still in "Lập ngân sách" would drop them
 * into a wizard they never asked for.
 *
 * It is still module-level state rather than screen state, so it survives
 * this screen unmounting — which it does on every bottom-nav tab change.
 */
export const useChatModeStore = create<ChatModeState>((set) => ({
  mode: DEFAULT_CHAT_MODE,
  setMode: (mode) => set({ mode }),
}));
