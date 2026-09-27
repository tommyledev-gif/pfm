import type { ReactElement } from "react";
import { create } from "zustand";

import { IconProps, InsightIcon, ReceiptIcon, TargetIcon } from "@/components/ui/Icon";
import { colors } from "@/lib/theme";

/**
 * Which of two separate conversations the chat screen shows. Each mode
 * renders its own thread and input — recording Transactions, or asking about
 * spending — so an answer never lands between proposals and a question is
 * never read as a Transaction description:
 *
 *   "tiêu 50k cafe"            → record a transaction
 *   "tiêu bao nhiêu cho cafe"  → answer a question about spending
 *
 * The User picks the mode instead of a model classifying every message, so
 * routing is never a guess and never costs a model call of its own.
 *
 * "budget" is the third entry: picking it opens the budget wizard modal over
 * the recording pane, and closing the wizard returns to "transaction" — it
 * has no conversation of its own.
 */
export type ChatMode = "transaction" | "budget" | "consult";

export const DEFAULT_CHAT_MODE: ChatMode = "transaction";

interface ChatModeMeta {
  label: string;
  /** Fits the header's mode pill. */
  shortLabel: string;
  /** One line, shown under the label in the picker. */
  description: string;
  /** Placeholder for the input bar while this mode is active. */
  placeholder: string;
  icon: (props: IconProps & { toColor?: string }) => ReactElement;
  /** Tints the header button and the picker's icon tile. */
  tint: string;
  /** Optional second colour: the icon is drawn as a tint → iconToColor gradient. */
  iconToColor?: string;
}

export const CHAT_MODE_META: Record<ChatMode, ChatModeMeta> = {
  transaction: {
    label: "Ghi giao dịch",
    shortLabel: "Giao dịch",
    // No voice input exists, so the copy promises typing only.
    description: "Ghi chi tiêu, thu nhập nhanh chỉ bằng một câu.",
    placeholder: "Mô tả một giao dịch…",
    icon: ReceiptIcon,
    tint: colors.green,
  },
  budget: {
    label: "Lập ngân sách",
    shortLabel: "Ngân sách",
    description: "Tạo kế hoạch tài chính thông minh dựa trên thói quen của bạn.",
    placeholder: "Mô tả một giao dịch…",
    icon: TargetIcon,
    tint: colors.lavender,
  },
  consult: {
    label: "Hỏi phân tích",
    shortLabel: "Phân tích",
    description: "Nhận phân tích sâu về thói quen chi tiêu của bạn.",
    placeholder: "Hỏi về chi tiêu của bạn…",
    icon: InsightIcon,
    tint: colors.mint,
    iconToColor: colors.info,
  },
};

/** Picker order — the default mode first. */
export const CHAT_MODE_ORDER: ChatMode[] = ["transaction", "budget", "consult"];

interface ChatModeState {
  mode: ChatMode;
  setMode: (mode: ChatMode) => void;
}

/**
 * Deliberately NOT persisted, unlike the thread it sits beside in
 * `chat-store.ts`: the mode describes what the user is doing right now, and
 * reopening the app two days later should land on recording, the thing
 * the chat is mostly for.
 *
 * It is still module-level state rather than screen state, so it survives
 * this screen unmounting — which it does on every bottom-nav tab change.
 */
export const useChatModeStore = create<ChatModeState>((set) => ({
  mode: DEFAULT_CHAT_MODE,
  setMode: (mode) => set({ mode }),
}));
