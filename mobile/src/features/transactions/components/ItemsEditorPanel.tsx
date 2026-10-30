import { SetStateAction, useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { DrawerChild } from "@/components/shared/Drawer";
import { ChevronRightIcon, PlusIcon } from "@/components/ui/Icon";
import { createStyles, spacing, useColors } from "@/lib/theme";
import { TRANSACTION_ADJUSTMENTS_MAX, TRANSACTION_ITEMS_MAX } from "@/lib/constants";
import { i18n } from "@/lib/i18n";
import { useKeyboardHeight } from "@/lib/use-keyboard-height";
import { useReduceMotion } from "@/lib/use-reduce-motion";
import { ItemsEditor } from "@/features/transactions/items/use-items-editor";
import { AdjustmentDraft, ItemDraft } from "@/features/transactions/items/line-math";
import { useItemsEditorStyles } from "@/features/transactions/components/items-editor-styles";
import { ItemRow } from "@/features/transactions/components/ItemRow";
import { animateLineLayout } from "@/features/transactions/components/ExpandableLine";
import { ADJUSTMENT_KIND_KEYS, AdjustmentRow } from "@/features/transactions/components/AdjustmentRow";
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

type Removed =
  | { kind: "item"; line: ItemDraft; index: number; adjustmentsBefore?: AdjustmentDraft[] }
  | { kind: "adjustment"; line: AdjustmentDraft; index: number };

/**
 * The Items editor as the form's slide-in child panel (specs/transaction-line-items US-01/US-03).
 * Called during the form's render, so the title is read in the current language.
 */
export function buildItemsPanelChild(options: ItemsPanelOptions): DrawerChild {
  return {
    visible: options.visible,
    onClose: options.onClose,
    title: i18n.t("transactions.items.title"),
    // The back chevron, X and "Xong" all return to the form; none discards,
    // the form's Lưu saves. Back is kept (2026-10-14): without it the panel
    // read as a dead end over the form.
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
  const { t } = useTranslation();
  const styles = useStyles();
  const lineStyles = useItemsEditorStyles();
  const keyboardHeight = useKeyboardHeight();
  const reduceMotion = useReduceMotion();
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
  // Every change to which line is open (or to the lines themselves) goes
  // through here or animates itself the same way: animateLineLayout makes the
  // whole list move together. A folding line's input gives up the keyboard
  // here, at once.
  const openLine = (next: SetStateAction<string | null>) => {
    Keyboard.dismiss();
    animateLineLayout(reduceMotion);
    setExpandedKey(next);
  };
  const toggle = (key: string) => {
    closeSwipes();
    openLine((current) => (current === key ? null : key));
  };
  const offerUndo = (entry: Removed) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setRemoved(entry);
    undoTimer.current = setTimeout(() => {
      animateLineLayout(reduceMotion);
      setRemoved(null);
    }, UNDO_MS);
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
    animateLineLayout(reduceMotion);
    if (removed.kind === "item") lines.restoreItem(removed.line, removed.index, removed.adjustmentsBefore);
    else lines.restoreAdjustment(removed.line, removed.index);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setRemoved(null);
  };

  const undoRow = (kind: Removed["kind"], index: number) => {
    if (!removed || removed.kind !== kind || removed.index !== index) return null;
    const name =
      removed.kind === "item"
        ? removed.line.name.trim() || t("transactions.items.undoFallbackName")
        : removed.line.kind === "other" && removed.line.label.trim() ? removed.line.label.trim() : t(ADJUSTMENT_KIND_KEYS[removed.line.kind]);
    return <ItemsUndoRow key={removed.line.key} label={t("transactions.items.removed", { name })} onUndo={undo} />;
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
          {divider(index, openItem)}
        </View>
      ))}
      {undoRow("item", lines.items.length)}
      {itemsFull ? (
        <Text style={lineStyles.hint}>{t("transactions.items.max", { count: TRANSACTION_ITEMS_MAX })}</Text>
      ) : (
        <AddRow label={t("transactions.items.add")} onPress={() => openLine(lines.addItem())} testID="btn-add-item" />
      )}

      {/* No Adjustment without an Item (BR-08). Folded to one row until used. */}
      {lines.items.length > 0 && !showAdjustments ? (
        <EntryRow label={t("common.adjustment.group")} onPress={() => openLine(lines.addAdjustment())} testID="btn-add-adjustment" />
      ) : null}
      {showAdjustments ? (
        <>
          <Text style={lineStyles.sectionTitle}>{t("common.adjustment.group")}</Text>
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
              {divider(index, openAdjustment)}
            </View>
          ))}
          {undoRow("adjustment", lines.adjustments.length)}
          {adjustmentsFull ? (
            <Text style={lineStyles.hint}>{t("transactions.adjustments.max", { count: TRANSACTION_ADJUSTMENTS_MAX })}</Text>
          ) : (
            <AddRow label={t("transactions.adjustments.add")} onPress={() => openLine(lines.addAdjustment())} testID="btn-add-adjustment-more" />
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
