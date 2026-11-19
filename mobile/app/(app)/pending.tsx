import { useMemo, useRef, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Screen } from "@/components/shared/Screen";
import { ChevronLeftIcon, CheckIcon } from "@/components/ui/Icon";
import { PillButton } from "@/components/ui/PillButton";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { useRequireOnline } from "@/lib/connectivity";
import { formatCurrency } from "@/lib/currency";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { PendingEditHandle, PendingEditHost } from "@/features/ai-chat/components/PendingEditHost";
import { PendingReviewCard } from "@/features/ai-chat/components/PendingReviewCard";
import { useTransactionRemoval } from "@/features/ai-chat/components/use-transaction-removal";
import { useConfirmProposal } from "@/features/ai-chat/hooks/use-confirm-proposal";
import { isPendingProposal } from "@/features/ai-chat/pending";
import { sortProposalsNewestFirst } from "@/features/ai-chat/proposal-time";
import { isSavableProposal, proposalWalletName } from "@/features/ai-chat/proposal-wallet";
import { removalDialogCopy } from "@/features/ai-chat/removal-copy";
import { ChatMessage } from "@/features/ai-chat/types";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { categoryLabel } from "@/features/categories/category-label";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { useChatStore } from "@/stores/chat-store";

const FALLBACK_CURRENCY = "VND";

type TypeFilter = "all" | "expense" | "income";

/**
 * Every AI transaction proposal still awaiting a decision, reviewable in one
 * place — opened from Home's "Chờ xác nhận" section via "Xem tất cả".
 *
 * Newest first, as on Home. Each card approves or discards on its own;
 * "Duyệt tất cả" saves every proposal in the current tab. Tapping a card
 * edits it in place without leaving this screen (PendingEditHost). Nothing
 * here ever deletes a message from the chat thread — see use-transaction-removal.
 */
export default function PendingReviewScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const requireOnline = useRequireOnline();
  const thread = useChatStore((s) => s.thread);
  const wallets = useWalletsQuery();
  const categories = useCategoriesQuery();
  const removal = useTransactionRemoval();
  const proposals = useConfirmProposal();
  // The edit sheet and the message it edits live in PendingEditHost: opening
  // it must not re-render this list.
  const editHost = useRef<PendingEditHandle>(null);

  const [filter, setFilter] = useState<TypeFilter>("all");

  const walletById = useMemo(() => new Map(wallets.data?.map((w) => [w.id, w])), [wallets.data]);
  const categoryById = useMemo(() => new Map(categories.data?.map((c) => [c.id, c])), [categories.data]);
  const currencyOf = (m: ChatMessage) =>
    walletById.get(m.action?.payload.wallet_id ?? "")?.currency ?? FALLBACK_CURRENCY;

  // Newest first: the thread is oldest first, and what was just proposed is
  // what the User came to review.
  const pending = useMemo(() => sortProposalsNewestFirst(thread.filter(isPendingProposal)), [thread]);
  const expenses = pending.filter((m) => m.action?.payload.type === "expense");
  const incomes = pending.filter((m) => m.action?.payload.type === "income");
  const visible = filter === "expense" ? expenses : filter === "income" ? incomes : pending;

  // Net effect on wallet balances if everything in the tab were approved.
  // Only summable within one currency — a mixed set says so instead of
  // adding VND to USD. A transfer moves money between two of the User's own
  // wallets, so it adds nothing.
  const currencies = new Set(visible.map(currencyOf));
  const net = visible.reduce((sum, m) => {
    const p = m.action!.payload;
    if (p.type === "transfer") return sum;
    return sum + (p.type === "income" ? p.amount : -p.amount);
  }, 0);
  const netLabel =
    currencies.size > 1
      ? t("pending.footer.mixedCurrencies")
      : `${net > 0 ? "+" : ""}${formatCurrency(net, [...currencies][0] ?? FALLBACK_CURRENCY)}`;

  const removalCopy = removalDialogCopy(removal.target, removal.targetIsPersisted, {
    currency: removal.target ? currencyOf(removal.target) : FALLBACK_CURRENCY,
    resolveCategoryName: (id) => categoryLabel(categoryById.get(id)) || undefined,
  });

  const tabs = [
    { value: "all" as const, label: t("pending.tabs.all", { count: pending.length }) },
    { value: "expense" as const, label: t("pending.tabs.expense", { count: expenses.length }) },
    { value: "income" as const, label: t("pending.tabs.income", { count: incomes.length }) },
  ];

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel={t("common.action.back")}>
          <ChevronLeftIcon size={24} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>
            {t("common.status.pending")} <Text style={styles.titleCount}>{pending.length}</Text>
          </Text>
          {/* The one instruction the screen needs, in place of the old banner
              and footer hint that said it twice. */}
          <Text style={styles.subtitle}>{t("pending.subtitle")}</Text>
        </View>
      </View>

      <SegmentedTabs style={styles.tabs} options={tabs} value={filter} onChange={setFilter} />

      <FlatList
        data={visible}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <PendingReviewCard
            message={item}
            category={categoryById.get(item.action?.payload.category_id ?? "")}
            walletName={item.action ? proposalWalletName(item.action.payload, walletById) : t("common.field.wallet")}
            currency={currencyOf(item)}
            confirming={proposals.confirmingId === item.id}
            locked={proposals.confirmingAll}
            // No VND Wallet yet: Confirm opens the edit form instead (spec AC-31).
            onConfirm={() =>
              item.action && !isSavableProposal(item.action.payload, walletById)
                ? editHost.current?.open(item)
                : requireOnline(() => proposals.confirm(item))
            }
            onEdit={() => editHost.current?.open(item)}
            onRemove={() => removal.request(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <CheckIcon size={24} color={colors.green} />
            </View>
            <Text style={styles.emptyTitle}>{t("pending.empty.title")}</Text>
            <Text style={styles.emptyText}>{t("pending.empty.body")}</Text>
          </View>
        }
      />

      {visible.length > 0 ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.footerSummary}>
            <Text style={styles.footerLabel}>{t("pending.footer.balanceChange")}</Text>
            <Text style={styles.footerNet} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {netLabel}
            </Text>
          </View>
          <PillButton
            label={t("pending.footer.approveAll", { count: visible.length })}
            // Saved oldest first although listed newest first: each save moves
            // a balance and is judged against what the earlier ones left.
            onPress={() => requireOnline(() => proposals.confirmAll([...visible].reverse()))}
            loading={proposals.confirmingAll}
            testID="btn-pending-review-confirm-all"
          />
        </View>
      ) : null}

      <PendingEditHost handleRef={editHost} />

      <ConfirmDialog
        visible={removal.target !== null}
        title={removalCopy.title}
        message={removalCopy.message}
        confirmLabel={removalCopy.confirmLabel}
        loading={removal.deleting}
        onCancel={removal.cancel}
        onConfirm={removal.confirm}
      />
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerText: { flex: 1, gap: 2 },
  title: { ...typography.title, color: colors.textPrimary },
  titleCount: { color: colors.textMuted },
  subtitle: { ...typography.caption, fontWeight: "500", color: colors.textSecondary },
  tabs: { marginHorizontal: spacing.xl, marginBottom: spacing.lg },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.md },
  empty: { alignItems: "center", gap: spacing.xs, marginTop: spacing.xxl * 3 },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: withAlpha(colors.green, 0.1),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  emptyTitle: { ...typography.cardTitle, color: colors.textPrimary },
  emptyText: { ...typography.caption, fontWeight: "500", color: colors.textSecondary },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    backgroundColor: colors.bgApp,
  },
  footerSummary: { flex: 1, minWidth: 0, gap: 2 },
  footerLabel: { ...typography.tiny, color: colors.textSecondary },
  footerNet: { ...typography.cardTitle, color: colors.textPrimary },
}));
