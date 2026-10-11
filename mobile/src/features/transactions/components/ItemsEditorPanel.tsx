import { ScrollView, Text } from "react-native";

import { DrawerChild } from "@/components/shared/Drawer";
import { PillButton } from "@/components/ui/PillButton";
import { PlusIcon } from "@/components/ui/Icon";
import { createStyles, spacing, useColors } from "@/lib/theme";
import { TRANSACTION_ADJUSTMENTS_MAX, TRANSACTION_ITEMS_MAX } from "@/lib/constants";
import { useKeyboardHeight } from "@/lib/use-keyboard-height";
import { ItemsEditor } from "@/features/transactions/items/use-items-editor";
import { useItemsEditorStyles } from "@/features/transactions/components/items-editor-styles";
import { ItemLineEditor } from "@/features/transactions/components/ItemLineEditor";
import { AdjustmentLineEditor } from "@/features/transactions/components/AdjustmentLineEditor";
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

/** The Items editor as the form's slide-in child panel (specs/transaction-line-items US-01/US-03). */
export function buildItemsPanelChild(options: ItemsPanelOptions): DrawerChild {
  return {
    visible: options.visible,
    onClose: options.onClose,
    title: "Các món",
    children: <ItemsEditorBody {...options} />,
    footer: (
      <ItemsTotalsPanel lines={options.lines} amountCents={options.amountCents} currency={options.currency} onDone={options.onClose} />
    ),
  };
}

function ItemsEditorBody({ lines, currency, showErrors }: ItemsPanelOptions) {
  const colors = useColors();
  const styles = useStyles();
  const lineStyles = useItemsEditorStyles();
  const itemsFull = lines.items.length >= TRANSACTION_ITEMS_MAX;
  const adjustmentsFull = lines.adjustments.length >= TRANSACTION_ADJUSTMENTS_MAX;
  // The panel body does not scroll by itself, and a long receipt is long.
  const keyboardHeight = useKeyboardHeight();

  return (
    <ScrollView
      testID="sheet-transaction-items"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.body, { paddingBottom: spacing.xl + keyboardHeight }]}
    >
      {lines.items.map((item, index) => (
        <ItemLineEditor
          key={item.key}
          item={item}
          index={index}
          count={lines.items.length}
          currency={currency}
          showErrors={showErrors}
          onChange={(patch) => lines.updateItem(item.key, patch)}
          onMove={(delta) => lines.moveItem(index, delta)}
          onRemove={() => lines.removeItem(item.key)}
        />
      ))}
      <PillButton
        testID="btn-add-item"
        label="Thêm món"
        variant="outline"
        icon={<PlusIcon size={ADD_ICON_SIZE} color={colors.textPrimary} />}
        onPress={lines.addItem}
        disabled={itemsFull}
      />
      {itemsFull ? <Text style={lineStyles.hint}>Tối đa {TRANSACTION_ITEMS_MAX} món.</Text> : null}

      {/* No Adjustment without an Item (BR-08). */}
      {lines.items.length > 0 ? (
        <>
          <Text style={lineStyles.sectionTitle}>Thuế, phí, giảm giá</Text>
          {lines.adjustments.map((adjustment, index) => (
            <AdjustmentLineEditor
              key={adjustment.key}
              adjustment={adjustment}
              index={index}
              count={lines.adjustments.length}
              currency={currency}
              showErrors={showErrors}
              onChange={(patch) => lines.updateAdjustment(adjustment.key, patch)}
              onMove={(delta) => lines.moveAdjustment(index, delta)}
              onRemove={() => lines.removeAdjustment(adjustment.key)}
            />
          ))}
          <PillButton
            testID="btn-add-adjustment"
            label="Thêm dòng"
            variant="outline"
            icon={<PlusIcon size={ADD_ICON_SIZE} color={colors.textPrimary} />}
            onPress={() => lines.addAdjustment()}
            disabled={adjustmentsFull}
          />
          {adjustmentsFull ? <Text style={lineStyles.hint}>Tối đa {TRANSACTION_ADJUSTMENTS_MAX} dòng.</Text> : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const useStyles = createStyles(() => ({
  body: { gap: spacing.sm },
}));
