import { useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import { CategorySelectField } from "@/components/shared/CategorySelectField";
import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { AmountInput } from "@/components/ui/AmountInput";
import { Chip } from "@/components/ui/Chip";
import { FieldError } from "@/components/ui/FieldError";
import { PillButton } from "@/components/ui/PillButton";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useCategoryPicker } from "@/features/categories/components/use-category-picker";
import {
  useCreateSpendingIntentionMutation,
  useUpdateSpendingIntentionMutation,
} from "@/features/spending-intentions/api/use-spending-intention-mutations";
import { intentionMonthLabel, nextMonths } from "@/features/spending-intentions/intention-draft";
import { setIntentionState } from "@/features/spending-intentions/intention-message-state";
import {
  INSTALLMENT_MAX_MONTHS,
  INSTALLMENT_MIN_MONTHS,
  INTENTION_MONTH_CHOICES,
  INTENTION_TITLE_MAX,
  IntentionKind,
  SpendingIntentionInput,
} from "@/features/spending-intentions/types";
import { errorText } from "@/lib/api-envelope";
import { useRequireOnline } from "@/lib/connectivity";
import { newIdempotencyKey } from "@/lib/idempotency-key";
import { toCents, toMajorUnits } from "@/lib/currency";
import { useSeedOnOpen } from "@/lib/use-seed-on-open";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { IntentionFormTarget } from "@/stores/intention-sheets-store";

interface IntentionFormModalProps {
  visible: boolean;
  onClose: () => void;
  /** What the form edits; held by the caller after it closes, so the content stays while it slides away. */
  target: IntentionFormTarget | null;
}

const KINDS: { value: IntentionKind; labelKey: "intentions.card.oneTime" | "intentions.form.installment" }[] = [
  { value: "one_time", labelKey: "intentions.card.oneTime" },
  { value: "installment", labelKey: "intentions.form.installment" },
];

const digitsOnly = (raw: string) => raw.replace(/[^0-9]/g, "");
const asMajor = (cents: number | null | undefined) => (cents ? String(toMajorUnits(cents)) : "");

/**
 * The new / edit form of a spending intention (spec.md US-02, US-03), in the
 * app's usual sheet. Seeded during render from what it edits: a card's draft,
 * a kept intention, or nothing. Saving a card's draft writes the kept
 * intention's id back to that card.
 */
export function IntentionFormModal({ visible, onClose, target }: IntentionFormModalProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const requireOnline = useRequireOnline();
  const categories = useCategoriesQuery("expense");
  const create = useCreateSpendingIntentionMutation();
  const update = useUpdateSpendingIntentionMutation();

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<IntentionKind>("one_time");
  const [amount, setAmount] = useState("");
  const [monthly, setMonthly] = useState("");
  const [months, setMonths] = useState("");
  const [month, setMonth] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  // One per open sheet: a double tap on Save is one intention.
  const [key, setKey] = useState(newIdempotencyKey);

  const editing = target?.kind === "edit" ? target.item : null;
  const messageId = target?.kind === "create" ? target.messageId : undefined;
  const itemIndex = target?.kind === "create" ? (target.itemIndex ?? 0) : 0;
  const seedKey = visible && target ? (editing ? `edit|${editing.id}` : `create|${messageId ?? ""}|${target.kind === "create" ? `${target.itemIndex ?? 0}|${target.draft?.title ?? ""}` : ""}`) : null;
  useSeedOnOpen(seedKey, (freshOpen) => {
    const source: SpendingIntentionInput | null = editing
      ? {
          title: editing.title, kind: editing.kind, category_id: editing.category_id ?? null,
          total_amount: editing.total_amount ?? null, monthly_amount: editing.monthly_amount ?? null,
          installment_months: editing.installment_months ?? null, target_month: editing.target_month,
        }
      : target?.kind === "create" ? target.draft : null;
    setTitle(source?.title ?? "");
    setKind(source?.kind ?? "one_time");
    setAmount(asMajor(source?.total_amount));
    setMonthly(asMajor(source?.monthly_amount));
    setMonths(source?.installment_months ? String(source.installment_months) : "");
    setMonth(source?.target_month ?? "");
    setCategoryId(source?.category_id ?? null);
    setSubmitAttempted(false);
    if (freshOpen) setKey(newIdempotencyKey());
  });

  // "This month" first, then the months ahead; a kept intention's own month
  // when it is none of those (an older plan) leads the row.
  const monthChoices = useMemo(() => {
    const ahead = nextMonths(INTENTION_MONTH_CHOICES - 1);
    return month && month !== "" && !ahead.includes(month) ? [month, "", ...ahead] : ["", ...ahead];
  }, [month]);

  const monthsNumber = Number(months);
  const installment = kind === "installment";
  const errors = {
    title: title.trim().length === 0 ? t("intentions.form.error.title") : undefined,
    months: installment && !(monthsNumber >= INSTALLMENT_MIN_MONTHS && monthsNumber <= INSTALLMENT_MAX_MONTHS)
      ? t("intentions.form.error.months", { min: INSTALLMENT_MIN_MONTHS, max: INSTALLMENT_MAX_MONTHS })
      : undefined,
    amount: installment && !(Number(amount) > 0) && !(Number(monthly) > 0) ? t("intentions.form.error.installmentAmount") : undefined,
  };
  const hasErrors = Boolean(errors.title || errors.months || errors.amount);

  const categoryPicker = useCategoryPicker({
    categories: categories.data ?? [],
    selectedIds: categoryId ? [categoryId] : [],
    onApply: (ids) => setCategoryId(ids[0] ?? null),
  });

  const mutation = editing ? update : create;
  const submit = () => {
    setSubmitAttempted(true);
    if (hasErrors) return;
    const body: SpendingIntentionInput = {
      title: title.trim(),
      kind,
      category_id: categoryId,
      currency: editing?.currency,
      total_amount: Number(amount) > 0 ? toCents(Number(amount)) : null,
      monthly_amount: installment && Number(monthly) > 0 ? toCents(Number(monthly)) : null,
      installment_months: installment ? monthsNumber : null,
      target_month: month,
      note: editing?.note ?? null,
    };
    const done = () => onClose();
    if (editing?.id) {
      update.mutate({ id: editing.id, body }, { onSuccess: done });
      return;
    }
    create.mutate(
      { ...body, idempotency_key: messageId ? `${messageId}:${itemIndex}` : key },
      {
        onSuccess: (kept) => {
          if (messageId) setIntentionState(messageId, itemIndex, { id: kept.id, state: "saved" });
          done();
        },
      },
    );
  };

  return (
    <Drawer
      visible={visible}
      onClose={onClose}
      keepMounted
      child={categoryPicker.child}
      footer={
        <View style={styles.footer}>
          <PillButton label={t("common.action.cancel")} variant="outline" onPress={onClose} style={styles.footerButton} />
          <PillButton
            label={editing ? t("common.action.save") : t("common.action.create")}
            onPress={() => requireOnline(submit)}
            loading={mutation.isPending}
            disabled={submitAttempted && hasErrors}
            testID="btn-intention-submit"
            style={styles.footerButton}
          />
        </View>
      }
    >
      <DrawerHeader title={editing ? t("intentions.form.titleEdit") : t("intentions.form.titleNew")} />

      <Text style={styles.label}>{t("intentions.form.name")}</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder={t("intentions.form.namePlaceholder")}
        placeholderTextColor={colors.textMuted}
        maxLength={INTENTION_TITLE_MAX}
        style={styles.input}
        testID="input-intention-title"
      />
      {submitAttempted ? <FieldError message={errors.title} /> : null}

      <View style={styles.chips}>
        {KINDS.map((option) => (
          <Chip key={option.value} label={t(option.labelKey)} active={kind === option.value} onPress={() => setKind(option.value)} />
        ))}
      </View>

      <Text style={styles.label}>{installment ? t("intentions.form.total") : t("intentions.form.amount")}</Text>
      <AmountInput value={amount} onChangeText={setAmount} testID="input-intention-amount" />

      {installment ? (
        <>
          <Text style={styles.label}>{t("intentions.form.monthly")}</Text>
          <AmountInput value={monthly} onChangeText={setMonthly} testID="input-intention-monthly" />
          <Text style={styles.label}>{t("intentions.form.months")}</Text>
          <TextInput
            value={months}
            onChangeText={(raw) => setMonths(digitsOnly(raw))}
            keyboardType="number-pad"
            maxLength={2}
            placeholder={`${INSTALLMENT_MIN_MONTHS}-${INSTALLMENT_MAX_MONTHS}`}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            testID="input-intention-months"
          />
          {submitAttempted ? <FieldError message={errors.months ?? errors.amount} /> : null}
        </>
      ) : null}

      <Text style={styles.label}>{t("intentions.form.month")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {monthChoices.map((value) => (
          <Chip
            key={value || "this"}
            label={value === "" ? t("common.date.thisMonth") : intentionMonthLabel(value)}
            active={month === value}
            onPress={() => setMonth(value)}
          />
        ))}
      </ScrollView>

      <Text style={styles.label}>{t("common.field.category")}</Text>
      <CategorySelectField categories={categoryPicker.selected} onPress={categoryPicker.open} />

      {mutation.isError ? <Text style={styles.error}>{errorText(mutation.error, "intentions.error.save")}</Text> : null}
    </Drawer>
  );
}

const useStyles = createStyles((colors) => ({
  label: { ...typography.caption, color: colors.textSecondary },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  chips: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  error: { ...typography.caption, color: colors.peach },
  footer: { flexDirection: "row", gap: spacing.sm },
  footerButton: { flex: 1 },
}));
