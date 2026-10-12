import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

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

type Removed =
  | { kind: "item"; line: ItemDraft; index: number; adjustmentsBefore?: AdjustmentDraft[] }
  | { kind: "adjustment"; line: AdjustmentDraft; index: number };

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
 * on tap, one line at a time. Removing is a swipe or the open line's "Xóa
 * món", and leaves an undo row in its place for a few seconds.
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
  const itemsFull = lines.items.length >= TRANSACTION_ITEMS_MAX;
  const adjustmentsFull = lines.adjustments.length >= TRANSACTION_ADJUSTMENTS_MAX;

  // Each open starts folded, with nothing left to undo.
  useEffect(() => {
    if (visible) return;
    setExpandedKey(null);
    setRemoved(null);
  }, [visible]);
  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  const closeSwipes = () => setCloseSignal((n) => n + 1);
  const toggle = (key: string) => {
    closeSwipes();
    setExpandedKey((current) => (current === key ? null : key));
  };

  const offerUndo = (entry: Removed) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setRemoved(entry);
    undoTimer.current = setTimeout(() => setRemoved(null), UNDO_MS);
  };
  const removeItem = (item: ItemDraft, index: number) => {
    // Removing the last Item takes the Adjustments with it (BR-08): keep them for the undo.
    const takesAdjustments = lines.items.length === 1 && lines.adjustments.length > 0;
    offerUndo({ kind: "item", line: item, index, adjustmentsBefore: takesAdjustments ? lines.adjustments : undefined });
    lines.removeItem(item.key);
    setExpandedKey(null);
    closeSwipes();
  };
  const removeAdjustment = (adjustment: AdjustmentDraft, index: number) => {
    offerUndo({ kind: "adjustment", line: adjustment, index });
    lines.removeAdjustment(adjustment.key);
    setExpandedKey(null);
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
    return <UndoRow label={`Đã xóa ${name}`} onUndo={undo} />;
  };

  const showAdjustments = lines.items.length > 0 && (lines.adjustments.length > 0 || removed?.kind === "adjustment");

  return (
    <ScrollView
      testID="sheet-transaction-items"
      keyboardShouldPersistTaps="handled"
      onScrollBeginDrag={closeSwipes}
      contentContainerStyle={[styles.body, { paddingBottom: spacing.xl + keyboardHeight }]}
    >
      {lines.items.map((item, index) => (
        <View key={item.key}>
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
          <View style={lineStyles.divider} />
        </View>
      ))}
      {undoRow("item", lines.items.length)}
      {itemsFull ? (
        <Text style={lineStyles.hint}>Tối đa {TRANSACTION_ITEMS_MAX} món.</Text>
      ) : (
        <AddRow label="Thêm món" onPress={() => setExpandedKey(lines.addItem())} testID="btn-add-item" />
      )}

      {/* No Adjustment without an Item (BR-08). Folded to one row until used. */}
      {lines.items.length > 0 && !showAdjustments ? (
        <EntryRow label="Thuế, phí, giảm giá" onPress={() => setExpandedKey(lines.addAdjustment())} testID="btn-add-adjustment" />
      ) : null}
      {showAdjustments ? (
        <>
          <Text style={lineStyles.sectionTitle}>Thuế, phí, giảm giá</Text>
          {lines.adjustments.map((adjustment, index) => (
            <View key={adjustment.key}>
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
              <View style={lineStyles.divider} />
            </View>
          ))}
          {undoRow("adjustment", lines.adjustments.length)}
          {adjustmentsFull ? (
            <Text style={lineStyles.hint}>Tối đa {TRANSACTION_ADJUSTMENTS_MAX} dòng.</Text>
          ) : (
            <AddRow label="Thêm dòng" onPress={() => setExpandedKey(lines.addAdjustment())} testID="btn-add-adjustment-more" />
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

function UndoRow({ label, onUndo }: { label: string; onUndo: () => void }) {
  const lineStyles = useItemsEditorStyles();
  return (
    <View style={lineStyles.undoRow} accessibilityLiveRegion="polite">
      <Text style={lineStyles.undoLabel} numberOfLines={1}>
        {label}
      </Text>
      <Pressable accessibilityRole="button" onPress={onUndo} hitSlop={12} testID="btn-items-undo">
        <Text style={lineStyles.undoAction}>Hoàn tác</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createStyles(() => ({
  body: { paddingTop: spacing.xs },
  entryRow: { marginTop: spacing.md },
  grow: { flex: 1 },
}));
