import { Ref, memo, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { InteractionManager } from "react-native";

import { EditTransactionModal } from "@/features/ai-chat/components/EditTransactionModal";
import { useChatActions } from "@/features/ai-chat/hooks/use-chat-actions";
import { ChatMessage } from "@/features/ai-chat/types";

/** What the pending-review screen calls to edit one proposal. */
export interface PendingEditHandle {
  open: (message: ChatMessage) => void;
}

interface PendingEditHostProps {
  handleRef: Ref<PendingEditHandle>;
}

/**
 * The edit sheet of the pending-review screen and the state that opens it,
 * apart from the screen.
 *
 * ⚠️ The open state used to live in the screen: tapping a card re-rendered the
 * whole list (every card, every closure) before the sheet could start sliding,
 * and the sheet was then built from scratch on top of that. Same fix as
 * TransactionFormHost: the screen holds a ref and a stable callback, and the
 * sheet is built once the screen has finished arriving (keepMounted) and only
 * slides on a tap.
 *
 * ⚠️ The edited message stays after the sheet closes (only `open` changes):
 * clearing it with `open` swapped the form's content for an empty one under
 * the closing slide.
 */
export const PendingEditHost = memo(function PendingEditHost({ handleRef }: PendingEditHostProps) {
  const { editAction } = useChatActions({ onSent: () => {} });
  const [state, setState] = useState<{ open: boolean; message: ChatMessage | null }>({ open: false, message: null });
  // Built after the screen's own transition, not with it: the form is the
  // heaviest thing here, and the push should not wait for it.
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setArmed(true));
    return () => task.cancel();
  }, []);

  useImperativeHandle(handleRef, () => ({ open: (message) => setState({ open: true, message }) }), []);
  const close = useCallback(() => setState((prev) => ({ ...prev, open: false })), []);

  const { message } = state;
  return (
    <EditTransactionModal
      visible={state.open}
      payload={message?.action?.payload ?? null}
      vndOnly
      keepMounted={armed}
      onClose={close}
      onSave={(payload) => {
        if (message) editAction(message, payload);
        close();
      }}
    />
  );
});
