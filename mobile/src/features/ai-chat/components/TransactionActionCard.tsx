import { useState } from "react";
import { Pressable, StyleSheet, Text, Vibration, View } from "react-native";

import { AmountRevealPopup } from "@/components/ui/AmountRevealPopup";
import { Avatar } from "@/components/ui/Avatar";
import { QuickActionsPopup } from "@/components/shared/QuickActionsPopup";
import { SwipeAction } from "@/components/shared/SwipeActionButton";
import { CalendarIcon, CheckIcon, EditIcon, TrashIcon } from "@/components/ui/Icon";
import { PillButton } from "@/components/ui/PillButton";
import { PillTag } from "@/components/ui/PillTag";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { colorForCategory } from "@/lib/category-color";
import { formatCurrencyTruncated } from "@/lib/currency";
import { formatDateShort } from "@/lib/format-date";
import { colors, spacing, typography } from "@/lib/theme";
import { ChatAction } from "@/features/ai-chat/types";

// Share of the budget at which the bar stops being neutral and starts
// leaning amber. Below it the number is just a number; at 80% the next
// transaction of this size is plausibly the one that crosses the line, which
// is exactly when it is worth a glance.
const NEAR_LIMIT_RATIO = 0.8;
// Hold this long on the card to open its Edit / Delete menu.
const LONG_PRESS_MS = 1000;

interface TransactionActionCardProps {
  action: ChatAction;
  walletName: string;
  categoryName: string;
  categoryIcon?: string | null;
  categoryIconUrl?: string | null;
  currency: string;
  confirmed: boolean;
  saving: boolean;
  onConfirm: () => void;
  // This proposal has been edited at least once (in place or via a
  // correction chain) — badged so it doesn't read as a brand-new AI guess.
  // Tapping the badge opens the edit-history dialog (onPressHistory).
  edited?: boolean;
  onPressHistory?: () => void;
  /** This category's budget for the transaction's currency, if it has one.
   *  Both in xu; `spent` is the cycle's spend BEFORE this proposal. */
  budgetLimit?: number;
  budgetSpent?: number;
  /** Same handlers as the bubble's swipe actions — omitted when that action
   *  is unavailable (edit-locked / not removable), exactly as the swipe is. */
  onEdit?: () => void;
  onDelete?: () => void;
}

// Renders inside an AI assistant chat bubble once a transaction has been
// parsed — README: "merchant name + amount (top row), two pill tags
// (category, wallet), and a full-width green Confirm & Save button."
// Once confirmed, the card collapses to a single compact row (check + label
// + amount) instead of repeating the full avatar/date/category-tag layout
// that only matters while the user is still deciding whether to save it —
// a thread with several already-saved transactions was taking up as much
// space as one still awaiting review.
export function TransactionActionCard({
  action,
  walletName,
  categoryName,
  categoryIcon,
  categoryIconUrl,
  currency,
  confirmed,
  saving,
  onConfirm,
  edited,
  onPressHistory,
  budgetLimit,
  budgetSpent,
  onEdit,
  onDelete,
}: TransactionActionCardProps) {
  const { payload } = action;
  const isIncome = payload.type === "income";

  /**
   * What this proposal would do to the category's budget, shown BEFORE it is
   * saved.
   *
   * ⚠️ This is the point of the whole feature: after the transaction exists the
   * number is a report, and reports get read monthly. Here it is still a
   * decision — the user is looking at a Confirm button, and a bar sitting at
   * 71% (or spilling past full) is the one piece of information that could
   * change what they press. No extra tap, no extra screen; they were already
   * looking at this card.
   *
   * Only for expenses with a real budget: income does not consume one, and a
   * category with no budget has no percentage to be at.
   */
  const impact =
    !isIncome && !confirmed && budgetLimit !== undefined && budgetLimit > 0
      ? (() => {
          const after = (budgetSpent ?? 0) + payload.amount;
          const ratio = after / budgetLimit;
          const over = ratio > 1;
          return {
            ratio,
            percent: Math.round(ratio * 100),
            // Amber when it would go over, a dimmer amber when it lands close,
            // neutral when there is still room — never red. Passing a budget is
            // a fact about a number, and this card is asking a question, not
            // refusing one. The Confirm button stays fully enabled either way.
            color: over
              ? colors.mustard
              : ratio >= NEAR_LIMIT_RATIO
                ? colors.mustardSoft
                : colors.textSecondary,
          };
        })()
      : null;
  const [revealVisible, setRevealVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const label = payload.note || categoryName;

  // Mirrors SwipeableMessageRow's two sides, so holding and swiping offer
  // the same choices.
  const menuActions: SwipeAction[] = [
    ...(onEdit
      ? [{ Icon: EditIcon, color: colors.green, label: "Sửa", testID: "btn-card-menu-edit", onPress: onEdit }]
      : []),
    ...(onDelete
      ? [
          {
            Icon: TrashIcon,
            color: colors.peach,
            label: "Xóa",
            destructive: true,
            testID: "btn-card-menu-delete",
            onPress: onDelete,
          },
        ]
      : []),
  ];
  const openMenu =
    menuActions.length > 0
      ? () => {
          Vibration.vibrate(20);
          setMenuVisible(true);
        }
      : undefined;

  const amountText = (
    <Pressable onLongPress={() => setRevealVisible(true)}>
      <Text
        style={[confirmed ? styles.compactAmount : styles.amount, { color: isIncome ? colors.green : colors.peach }]}
        numberOfLines={1}
      >
        {isIncome ? "+" : "-"}
        {formatCurrencyTruncated(payload.amount, currency)}
      </Text>
    </Pressable>
  );

  return (
    <Pressable style={styles.card} onLongPress={openMenu} delayLongPress={LONG_PRESS_MS}>
      {edited ? (
        <Pressable style={styles.editedBadge} onPress={onPressHistory} disabled={!onPressHistory}>
          <EditIcon size={12} color={colors.lavender} />
          <Text style={styles.editedLabel}>Đã sửa</Text>
        </Pressable>
      ) : null}

      {confirmed ? (
        <View style={styles.compactRow}>
          <CheckIcon size={16} color={colors.green} />
          <Text style={styles.compactLabel} numberOfLines={1}>
            {label}
          </Text>
          {amountText}
        </View>
      ) : (
        <>
          <View style={styles.topRow}>
            <Avatar
              name={categoryName}
              color={colorForCategory(payload.category_id)}
              size={32}
              icon={categoryIcon}
              iconUrl={categoryIconUrl}
            />
            <Text style={styles.merchant} numberOfLines={1}>
              {label}
            </Text>
            {amountText}
          </View>
          <View style={styles.dateRow}>
            <CalendarIcon size={13} color={colors.textSecondary} />
            <Text style={styles.dateLabel}>{formatDateShort(payload.occurred_at)}</Text>
            {impact ? (
              // Trailing on the date's own row: it is context for the decision,
              // not an action, so it sits at the quiet end of a line the user
              // already scans rather than claiming a row of its own.
              //
              // A bar rather than a sentence: how full the budget already is
              // reads off the shape at a glance, which is all this needs to do
              // while the user's attention is really on the Confirm button. The
              // percentage trails it for the one case where the exact number
              // matters.
              <View style={styles.impactGroup}>
                <View style={styles.impactTrack}>
                  <ProgressBar progress={impact.ratio} color={impact.color} height={4} />
                </View>
                <Text
                  testID="text-chat-budget-after"
                  style={[styles.impactPercent, { color: impact.color }]}
                  numberOfLines={1}
                >
                  {impact.percent}%
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.tagRow}>
            <PillTag label={categoryName} />
            <PillTag label={walletName} />
          </View>
          <View style={styles.actionRow}>
            <PillButton
              label="Xác nhận & Lưu"
              onPress={onConfirm}
              loading={saving}
              style={styles.confirmButton}
            />
          </View>
        </>
      )}

      <AmountRevealPopup
        visible={revealVisible}
        onClose={() => setRevealVisible(false)}
        amountCents={payload.amount}
        currency={currency}
      />
      <QuickActionsPopup
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        title={label}
        actions={menuActions}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, marginTop: spacing.sm },
  editedBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  editedLabel: { ...typography.tiny, color: colors.lavender },
  compactRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  compactLabel: { flex: 1, ...typography.caption, color: colors.textSecondary },
  compactAmount: { ...typography.caption },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  merchant: { flex: 1, ...typography.body, color: colors.textPrimary },
  amount: { ...typography.cardTitle },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  impactGroup: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: spacing.sm },
  // Capped so the bar stays a small trailing indicator on a date row — full
  // width would read as the row's main content — and floored so a short date
  // never squeezes it down to a dash.
  impactTrack: { flex: 1, minWidth: 40, maxWidth: 110 },
  impactPercent: { ...typography.tiny, minWidth: 30, textAlign: "right" },
  dateLabel: { ...typography.tiny, color: colors.textSecondary },
  tagRow: { flexDirection: "row", gap: spacing.sm },
  actionRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  confirmButton: { flex: 1 },
});
