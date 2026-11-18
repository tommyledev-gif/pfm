import { IntentionFormModal } from "@/features/spending-intentions/components/IntentionFormModal";
import { IntentionsDrawer } from "@/features/spending-intentions/components/IntentionsDrawer";
import { useIntentionSheetsStore } from "@/stores/intention-sheets-store";

/**
 * The two intention sheets, built with the analysis pane and waiting below the
 * edge (Drawer keepMounted): the list, and the form that opens on top of it or
 * on its own from a card. Which is open lives in the sheets store, so a card
 * in the thread asking for one re-renders only this.
 *
 * The form comes after the list in the tree, so it paints above it.
 */
export function IntentionSheetsHost() {
  const listOpen = useIntentionSheetsStore((s) => s.listOpen);
  const closeList = useIntentionSheetsStore((s) => s.closeList);
  const formOpen = useIntentionSheetsStore((s) => s.formOpen);
  const formTarget = useIntentionSheetsStore((s) => s.formTarget);
  const closeForm = useIntentionSheetsStore((s) => s.closeForm);
  return (
    <>
      <IntentionsDrawer visible={listOpen} onClose={closeList} />
      <IntentionFormModal visible={formOpen} onClose={closeForm} target={formTarget} />
    </>
  );
}
