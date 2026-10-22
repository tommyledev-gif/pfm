import { useMemo } from "react";
import { StyleProp, ViewStyle } from "react-native";

import { ExpandableFab, FabAction } from "@/components/ui/ExpandableFab";
import { EditIcon, SparkleIcon } from "@/components/ui/Icon";

interface BudgetsFabProps {
  /** Opens the guided setup (its first step asks for income). Omitted → no AI action. */
  onOpenWizard?: () => void;
  onCreate: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * The Budgets tab's "add" button: it opens into the two ways of adding —
 * let AI propose a whole plan, or add one budget by hand.
 *
 * Floating over the list rather than a header button: the list is the whole
 * screen, and "add" shouldn't cost a row of it. Lifted clear of the floating
 * BottomNav and the safe-area inset the same way the plain Fab is.
 */
export function BudgetsFab({ onOpenWizard, onCreate, style }: BudgetsFabProps) {
  const actions = useMemo<FabAction[]>(
    () => [
      ...(onOpenWizard
        ? [{ key: "wizard", label: "AI gợi ý", Icon: SparkleIcon, onPress: onOpenWizard, testID: "btn-new-budget-wizard" }]
        : []),
      { key: "manual", label: "Thủ công", Icon: EditIcon, onPress: onCreate, testID: "btn-new-budget-manual" },
    ],
    [onOpenWizard, onCreate],
  );
  return <ExpandableFab actions={actions} accessibilityLabel="Thêm ngân sách" testID="btn-new-budget" style={style} />;
}
