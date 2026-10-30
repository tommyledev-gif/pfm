import { useTranslation } from "react-i18next";

import { PopoverAction } from "@/components/shared/ActionPopover";
import { CopyIcon, EditIcon, PinIcon, TrashIcon } from "@/components/ui/Icon";
import { copyToClipboard } from "@/lib/clipboard";
import { formatProposalForCopy } from "@/features/ai-chat/message-copy";
import { messageText } from "@/features/ai-chat/message-text";
import { proposalCreatedAt } from "@/features/ai-chat/proposal-time";
import { ChatMessage } from "@/features/ai-chat/types";
import { usePhraseActions } from "@/features/ai-chat/hooks/use-phrase-actions";

interface ProposalCopyContext {
  categoryName: string;
  walletName: string;
  currency: string;
}

interface UseMessageActionsOptions {
  message: ChatMessage;
  /** Present when the message carries a proposal — Copy then copies the record. */
  proposal?: ProposalCopyContext;
  /** The same handlers the row's swipe gets; omitted when unavailable there. */
  onEdit?: () => void;
  onDelete?: () => void;
  /** Offer Save / Remove saved phrase (the User's own recording messages). */
  phraseActions?: boolean;
}

/**
 * The actions a held message offers: Copy, Edit, the saved-phrase toggle,
 * and Delete last (destructive at the end, by convention). Edit and Delete are
 * exactly what the message's swipe offers, so holding and swiping never
 * disagree about what can be done to it.
 */
export function useMessageActions({
  message,
  proposal,
  onEdit,
  onDelete,
  phraseActions,
}: UseMessageActionsOptions): PopoverAction[] {
  const { t } = useTranslation();
  const phrase = usePhraseActions(phraseActions ? message.text : null);

  const copyText = (): string | null => {
    if (message.action && proposal) {
      return formatProposalForCopy({
        payload: message.action.payload,
        ...proposal,
        createdAtMs: proposalCreatedAt(message),
      });
    }
    const text = messageText(message);
    return text.trim() ? text : null;
  };
  const hasCopy = Boolean(message.action && proposal) || message.text.trim().length > 0;

  const actions: PopoverAction[] = [];
  if (hasCopy) {
    actions.push({
      Icon: CopyIcon,
      label: t("chat.messageMenu.copy"),
      testID: "btn-msg-menu-copy",
      onPress: () => {
        const text = copyText();
        if (text) void copyToClipboard(text);
      },
    });
  }
  if (onEdit) {
    actions.push({ Icon: EditIcon, label: t("common.action.edit"), testID: "btn-msg-menu-edit", onPress: onEdit });
  }
  if (phrase.available) {
    actions.push({
      Icon: PinIcon,
      label: phrase.saved ? t("chat.phrases.unsave") : t("chat.phrases.save"),
      testID: phrase.saved ? "btn-msg-menu-unsave-phrase" : "btn-msg-menu-save-phrase",
      onPress: phrase.toggle,
    });
  }
  if (onDelete) {
    actions.push({
      Icon: TrashIcon,
      label: t("common.action.delete"),
      destructive: true,
      testID: "btn-msg-menu-delete",
      onPress: onDelete,
    });
  }
  return actions;
}
