import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { AmountInput } from "@/components/ui/AmountInput";
import { MoneySlider } from "@/components/ui/MoneySlider";
import { MIN_AMOUNT_PER_CATEGORY_XU, roundStepXu } from "@/features/budget-wizard/budget-math";
import { findSimilarCategories } from "@/features/budget-wizard/category-match";
import { Category } from "@/features/categories/types";
import { formatCurrency, toCents, toMajorUnits } from "@/lib/currency";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";

export interface AddBudgetRowResult {
  /** Set when the user reused an existing category; null when they insisted on a new one. */
  categoryId: string | null;
  name: string;
  amountXu: number;
}

interface AddBudgetRowModalProps {
  visible: boolean;
  currency: string;
  /** What is still unallocated — the ceiling for the new row. */
  buffer: number;
  /** Every category the user can see, for the duplicate check. */
  categories: Category[];
  /** Categories already on the proposal, so the modal can say so instead of duplicating a row. */
  usedCategoryIds: string[];
  onClose: () => void;
  onConfirm: (result: AddBudgetRowResult) => void;
}

/**
 * Add one more budget line.
 *
 * Two steps, and the second only appears when it has something to say: enter a
 * name and an amount, and if that name looks like a category that already
 * exists, confirm which one is meant before anything is added.
 *
 * ⚠️ The duplicate check is the reason this is a modal rather than an inline
 * row. "Cafe" and "Cà phê" as two categories is not a cosmetic problem — every
 * later report splits that habit in half, and by the time anyone notices there
 * are transactions on both. The one moment it is cheap to resolve is here,
 * before either exists.
 */
export function AddBudgetRowModal({
  visible,
  currency,
  buffer,
  categories,
  usedCategoryIds,
  onClose,
  onConfirm,
}: AddBudgetRowModalProps) {
  const colors = useColors();
  const styles = useStyles();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(0);
  // Null while entering; set once the user submits a name with lookalikes.
  const [confirmingMatches, setConfirmingMatches] = useState<Category[] | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName("");
    setAmount(0);
    setConfirmingMatches(null);
  }, [visible]);

  // The buffer is the whole ceiling: a new line can only be funded by money
  // that has not been given to anything else. Same zero-sum rule the per-row
  // editor enforces.
  const max = Math.max(buffer, 0);
  const clamped = Math.min(Math.max(amount, 0), max);
  const canSubmit = name.trim().length > 0 && clamped >= MIN_AMOUNT_PER_CATEGORY_XU;

  const used = useMemo(() => new Set(usedCategoryIds), [usedCategoryIds]);

  const submit = () => {
    if (!canSubmit) return;
    const matches = findSimilarCategories(name, categories).map((m) => m.category);
    if (matches.length > 0) {
      setConfirmingMatches(matches);
      return;
    }
    onConfirm({ categoryId: null, name: name.trim(), amountXu: clamped });
  };

  if (max < MIN_AMOUNT_PER_CATEGORY_XU) {
    return (
      <Drawer visible={visible} onClose={onClose}>
        <DrawerHeader title="Thêm danh mục" actions={[{ label: "Đóng", onPress: onClose, variant: "secondary" }]} />
        <View style={styles.body}>
          {/* Not an error — the plan is simply fully allocated. Saying so beats
              offering a form whose submit button could never be enabled. */}
          <Text style={styles.note}>
            Dự phòng đã hết. Giảm một mục khác để thêm mục mới.
          </Text>
        </View>
      </Drawer>
    );
  }

  return (
    <Drawer visible={visible} onClose={onClose}>
      {confirmingMatches ? (
        <>
          <DrawerHeader
            title="Dùng mục có sẵn?"
            actions={[{ label: "Quay lại", onPress: () => setConfirmingMatches(null), variant: "secondary" }]}
          />
          <View style={styles.body}>
            <Text style={styles.note}>
              Có vài mục giống &quot;{name.trim()}&quot;.
            </Text>

            {confirmingMatches.map((category) => {
              const alreadyOnPlan = used.has(category.id);
              return (
                <Pressable
                  key={category.id}
                  testID={`btn-wizard-reuse-category-${category.id}`}
                  disabled={alreadyOnPlan}
                  onPress={() =>
                    onConfirm({ categoryId: category.id, name: category.name, amountXu: clamped })
                  }
                  style={[styles.matchRow, alreadyOnPlan && styles.matchRowDisabled]}
                >
                  <Text style={styles.matchName} numberOfLines={1}>
                    {category.icon ? `${category.icon} ` : ""}
                    {category.name}
                  </Text>
                  <Text style={styles.matchMeta}>
                    {alreadyOnPlan ? "đã có trong kế hoạch" : category.user_id ? "của bạn" : "mục hệ thống"}
                  </Text>
                </Pressable>
              );
            })}

            {/* The escape hatch has to stay: sometimes "Cafe" really is a
                different thing from "Cà phê sáng", and only the user knows. */}
            <Pressable
              testID="btn-wizard-create-category-anyway"
              onPress={() => onConfirm({ categoryId: null, name: name.trim(), amountXu: clamped })}
              style={styles.createAnyway}
            >
              <Text style={styles.createAnywayLabel}>Không, tạo mục &quot;{name.trim()}&quot; mới</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <DrawerHeader
            title="Thêm danh mục"
            actions={[
              { label: "Hủy", onPress: onClose, variant: "secondary" },
              { label: "Thêm", onPress: submit, variant: "primary", disabled: !canSubmit, testID: "btn-wizard-add-row-submit" },
            ]}
          />
          <View style={styles.body}>
            <Text style={styles.label}>Tên danh mục</Text>
            <TextInput
              testID="input-wizard-add-row-name"
              value={name}
              onChangeText={setName}
              placeholder="vd: Thú cưng"
              placeholderTextColor={colors.textMuted}
              style={styles.nameInput}
            />

            <Text style={styles.label}>Mỗi tháng muốn chi</Text>
            <AmountInput
              testID="input-wizard-add-row-amount"
              value={clamped > 0 ? String(toMajorUnits(clamped)) : ""}
              onChangeText={(t) => setAmount(Math.min(toCents(Number(t) || 0), max))}
              style={styles.amountInput}
            />
            <MoneySlider
              testID="slider-wizard-add-row-amount"
              value={clamped}
              min={0}
              max={max}
              step={roundStepXu(max)}
              onChange={setAmount}
            />

            <View style={styles.meta}>
              <Text style={styles.metaLabel}>Lấy từ dự phòng, tối đa</Text>
              <Text style={styles.metaValue}>{formatCurrency(max, currency)}</Text>
            </View>
            {name.trim().length > 0 && clamped < MIN_AMOUNT_PER_CATEGORY_XU ? (
              <Text style={styles.note}>
                Tối thiểu {formatCurrency(MIN_AMOUNT_PER_CATEGORY_XU, currency)}. Thấp hơn thì một lần chi
                bình thường đã vượt hạn mức.
              </Text>
            ) : null}
          </View>
        </>
      )}
    </Drawer>
  );
}

const useStyles = createStyles((colors) => ({
  body: { gap: spacing.sm, paddingBottom: spacing.md },
  label: { ...typography.caption, color: colors.textSecondary },
  nameInput: {
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
  },
  amountInput: { textAlign: "right" },
  meta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  metaLabel: { ...typography.caption, color: colors.textSecondary },
  metaValue: { ...typography.label, color: colors.textPrimary },
  note: { ...typography.tiny, color: colors.textMuted, lineHeight: 16 },
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.listCard,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  matchRowDisabled: { opacity: 0.45 },
  matchName: { flex: 1, ...typography.body, color: colors.textPrimary },
  matchMeta: { ...typography.tiny, color: colors.textMuted },
  createAnyway: { paddingVertical: spacing.sm, alignItems: "center" },
  createAnywayLabel: { ...typography.caption, color: colors.green },
}));
