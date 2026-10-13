import { SetStateAction, useEffect, useRef, useState } from "react";
import { Keyboard, LayoutChangeEvent, Pressable, ScrollView, Text, View } from "react-native";

import { DrawerChild } from "@/components/shared/Drawer";
import { ChevronRightIcon, PlusIcon } from "@/components/ui/Icon";
import { createStyles, spacing, useColors } from "@/lib/theme";
import { TRANSACTION_ADJUSTMENTS_MAX, TRANSACTION_ITEMS_MAX } from "@/lib/constants";
import { useKeyboardHeight } from "@/lib/use-keyboard-height";
import { ItemsEditor } from "@/features/transactions/items/use-items-editor";
import { AdjustmentDraft, ItemDraft } from "@/features/transactions/items/line-math";
import { useItemsEditorStyles } from "@/features/transactions/components/items-editor-styles";
import { ItemRow } from "@/features/transactions/components/ItemRow";
import { ADJUSTMENT_KIND_LABELS, AdjustmentRow } from "@/features/transactions/components/AdjustmentRow";
import { ItemsTotalsPanel } from "@/features/transactions/components/ItemsTotalsPanel";
import { ItemsUndoRow } from "@/features/transactions/components/ItemsUndoRow";

interface ItemsPanelOptions {
  visible: boolean;
  onClose: () => void;
  lines: ItemsEditor;
  amountCents: number | null;
  currency: string;
  showErrors: boolean;
}

const ADD_ICON_SIZE = 16;
// How long a removed line can be brought back.
const UNDO_MS = 5000;

type RemovedLine =
  | { kind: "item"; line: ItemDraft; index: number; adjustmentsBefore?: AdjustmentDraft[] }
  | { kind: "adjustment"; line: AdjustmentDraft; index: number };
// Plus what its undo row needs: the height it takes over, and whether its
// time is up and it is folding away.
type Removed = RemovedLine & { fromHeight: number; leaving: boolean };

/** The Items editor as the form's slide-in child panel (specs/transaction-line-items US-01/US-03). */
export function buildItemsPanelChild(options: ItemsPanelOptions): DrawerChild {
  return {
    visible: options.visible,
    onClose: options.onClose,
    title: "Chi tiết món",
    // One way out besides X: "Xong". Neither discards; the form's Lưu saves.
    hideBack: true,
    children: <ItemsEditorBody {...options} />,
    footer: (
      <ItemsTotalsPanel lines={options.lines} amountCents={options.amountCents} currency={options.currency} onDone={options.onClose} />
    ),
  };
}

/**
 * Read first, edit second: most opens are to check what the AI read off a
 * receipt, so every line is one row (name, amount) and its fields open only
 * on tap, one line at a time, as a card grown out of the row (ExpandableLine).
 * Removing is a swipe or the open line's "Xóa món", and leaves an undo row in
 * its place for a few seconds.
 */
function ItemsEditorBody({ visible, lines, currency, showErrors }: ItemsPanelOptions) {
  const styles = useStyles();
  const lineStyles = useItemsEditorStyles();
  const keyboardHeight = useKeyboardHeight();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Removed | null>(null);
  // Bumped to close any parked swipe (scroll, another row opened).
  const [closeSignal, setCloseSignal] = useState(0);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Each line's last height (row, open fields, divider), for its undo row to start from.
  const lineHeights = useRef(new Map<string, number>());
  const itemsFull = lines.items.length >= TRANSACTION_ITEMS_MAX;
  const adjustmentsFull = lines.adjustments.length >= TRANSACTION_ADJUSTMENTS_MAX;

  // Each open starts folded, with nothing left to undo.
  useEffect(() => {
    if (visible) return;
    setExpandedKey(null);
    setRemoved(null);
    lineHeights.current.clear();
  }, [visible]);
  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  const closeSwipes = () => setCloseSignal((n) => n + 1);
  // A folding line keeps its fields mounted until they have folded away, so
  // its input gives up the keyboard here, at once, as it did back when
  // folding unmounted the fields straight away.
  const openLine = (next: SetStateAction<string | null>) => {
    Keyboard.dismiss();
    setExpandedKey(next);
  };
  const toggle = (key: string) => {
    closeSwipes();
    openLine((current) => (current === key ? null : key));
  };
  const trackHeight = (key: string) => (event: LayoutChangeEvent) => {
    lineHeights.current.set(key, event.nativeEvent.layout.height);
  };

  const offerUndo = (entry: RemovedLine) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setRemoved({ ...entry, fromHeight: lineHeights.current.get(entry.line.key) ?? 0, leaving: false });
    undoTimer.current = setTimeout(() => setRemoved((current) => (current ? { ...current, leaving: true } : null)), UNDO_MS);
  };
  const removeItem = (item: ItemDraft, index: number) => {
    // Removing the last Item takes the Adjustments with it (BR-08): keep them for the undo.
    const takesAdjustments = lines.items.length === 1 && lines.adjustments.length > 0;
    offerUndo({ kind: "item", line: item, index, adjustmentsBefore: takesAdjustments ? lines.adjustments : undefined });
    lines.removeItem(item.key);
    openLine(null);
    closeSwipes();
  };
  const removeAdjustment = (adjustment: AdjustmentDraft, index: number) => {
    offerUndo({ kind: "adjustment", line: adjustment, index });
    lines.removeAdjustment(adjustment.key);
    openLine(null);
    closeSwipes();
  };
  const undo = () => {
    if (!removed) return;
    if (removed.kind === "item") lines.restoreItem(removed.line, removed.index, removed.adjustmentsBefore);
    else lines.restoreAdjustment(removed.line, removed.index);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setRemoved(null);
  };

  const undoRow = (kind: Removed["kind"], index: number) => {
    if (!removed || removed.kind !== kind || removed.index !== index) return null;
    const name =
      removed.kind === "item"
        ? removed.line.name.trim() || "món"
        : removed.line.kind === "other" && removed.line.label.trim() ? removed.line.label.trim() : ADJUSTMENT_KIND_LABELS[removed.line.kind];
    const removedKey = removed.line.key;
    return (
      <ItemsUndoRow
        key={removedKey}
        label={`Đã xóa ${name}`}
        fromHeight={removed.fromHeight}
        leaving={removed.leaving}
        onUndo={undo}
        // Only its own entry: a later removal may have taken its place meanwhile.
        onGone={() => setRemoved((current) => (current?.line.key === removedKey ? null : current))}
      />
    );
  };

  // The hairlines on either side of the open line give way to its card's edge.
  const openItem = lines.items.findIndex((item) => item.key === expandedKey);
  const openAdjustment = lines.adjustments.findIndex((adjustment) => adjustment.key === expandedKey);
  const divider = (index: number, open: number) => (
    <View style={[lineStyles.divider, (index === open || index + 1 === open) && lineStyles.dividerHidden]} />
  );

  const showAdjustments = lines.items.length > 0 && (lines.adjustments.length > 0 || removed?.kind === "adjustment");

  return (
    <ScrollView
      testID="sheet-transaction-items"
      keyboardShouldPersistTaps="handled"
      onScrollBeginDrag={closeSwipes}
      style={lineStyles.list}
      contentContainerStyle={[styles.body, lineStyles.listContent, { paddingBottom: spacing.xl + keyboardHeight }]}
    >
      {lines.items.map((item, index) => (
        <View key={item.key} onLayout={trackHeight(item.key)}>
          {undoRow("item", index)}
          <ItemRow
            item={item}
            index={index}
            currency={currency}
            expanded={expandedKey === item.key}
            showErrors={showErrors}
            closeSignal={closeSignal}
            onToggle={() => toggle(item.key)}
            onChange={(patch) => lines.updateItem(item.key, patch)}
            onRemove={() => removeItem(item, index)}
          />
          {divider(index, openItem)}
        </View>
      ))}
      {undoRow("item", lines.items.length)}
      {itemsFull ? (
        <Text style={lineStyles.hint}>Tối đa {TRANSACTION_ITEMS_MAX} món.</Text>
      ) : (
        <AddRow label="Thêm món" onPress={() => openLine(lines.addItem())} testID="btn-add-item" />
      )}

      {/* No Adjustment without an Item (BR-08). Folded to one row until used. */}
      {lines.items.length > 0 && !showAdjustments ? (
        <EntryRow label="Thuế, phí, giảm giá" onPress={() => openLine(lines.addAdjustment())} testID="btn-add-adjustment" />
      ) : null}
      {showAdjustments ? (
        <>
          <Text style={lineStyles.sectionTitle}>Thuế, phí, giảm giá</Text>
          {lines.adjustments.map((adjustment, index) => (
            <View key={adjustment.key} onLayout={trackHeight(adjustment.key)}>
              {undoRow("adjustment", index)}
              <AdjustmentRow
                adjustment={adjustment}
                index={index}
                currency={currency}
                expanded={expandedKey === adjustment.key}
                showErrors={showErrors}
                closeSignal={closeSignal}
                onToggle={() => toggle(adjustment.key)}
                onChange={(patch) => lines.updateAdjustment(adjustment.key, patch)}
                onRemove={() => removeAdjustment(adjustment, index)}
              />
              {divider(index, openAdjustment)}
            </View>
          ))}
          {undoRow("adjustment", lines.adjustments.length)}
          {adjustmentsFull ? (
            <Text style={lineStyles.hint}>Tối đa {TRANSACTION_ADJUSTMENTS_MAX} dòng.</Text>
          ) : (
            <AddRow label="Thêm dòng" onPress={() => openLine(lines.addAdjustment())} testID="btn-add-adjustment-more" />
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

function AddRow({ label, onPress, testID }: { label: string; onPress: () => void; testID: string }) {
  const colors = useColors();
  const lineStyles = useItemsEditorStyles();
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={lineStyles.addRow}>
      <PlusIcon size={ADD_ICON_SIZE} color={colors.textSecondary} />
      <Text style={lineStyles.addLabel}>{label}</Text>
    </Pressable>
  );
}

function EntryRow({ label, onPress, testID }: { label: string; onPress: () => void; testID: string }) {
  const colors = useColors();
  const styles = useStyles();
  const lineStyles = useItemsEditorStyles();
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={[lineStyles.addRow, styles.entryRow]}>
      <Text style={[lineStyles.addLabel, styles.grow]}>{label}</Text>
      <ChevronRightIcon size={ADD_ICON_SIZE} color={colors.textMuted} />
    </Pressable>
  );
}

const useStyles = createStyles(() => ({
  body: { paddingTop: spacing.xs },
  entryRow: { marginTop: spacing.md },
  grow: { flex: 1 },
}));
