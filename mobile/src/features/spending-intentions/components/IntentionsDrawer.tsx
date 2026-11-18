import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { PillButton } from "@/components/ui/PillButton";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { useDeleteSpendingIntentionMutation } from "@/features/spending-intentions/api/use-spending-intention-mutations";
import { useSpendingIntentionsQuery } from "@/features/spending-intentions/api/use-spending-intentions-query";
import { IntentionPortfolioView } from "@/features/spending-intentions/components/IntentionPortfolioView";
import { IntentionRow } from "@/features/spending-intentions/components/IntentionRow";
import { SpendingIntention } from "@/features/spending-intentions/types";
import { errorText } from "@/lib/api-envelope";
import { useRequireOnline } from "@/lib/connectivity";
import { isWaitingForNetwork } from "@/lib/query-status";
import { spacing, typography, createStyles } from "@/lib/theme";
import { useIntentionSheetsStore } from "@/stores/intention-sheets-store";

const SKELETON_ROWS = 3;
const SKELETON_HEIGHT = 112;

interface IntentionsDrawerProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * The User's planned spending, soonest month first, each with figures worked
 * out now (spec.md US-03). Edit opens the form on top; delete asks first.
 */
export function IntentionsDrawer({ visible, onClose }: IntentionsDrawerProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const requireOnline = useRequireOnline();
  const openForm = useIntentionSheetsStore((s) => s.openForm);
  const list = useSpendingIntentionsQuery({ enabled: visible });
  const remove = useDeleteSpendingIntentionMutation();
  // Held after the dialog closes, so its text does not change as it fades.
  const [deleting, setDeleting] = useState<{ item: SpendingIntention; open: boolean } | null>(null);

  const edit = useCallback((item: SpendingIntention) => openForm({ kind: "edit", item }), [openForm]);
  const askDelete = useCallback((item: SpendingIntention) => requireOnline(() => setDeleting({ item, open: true })), [requireOnline]);
  const confirmDelete = () => {
    const target = deleting?.item;
    setDeleting((prev) => (prev ? { ...prev, open: false } : prev));
    if (target?.id) remove.mutate(target.id);
  };
  const add = () => openForm({ kind: "create", draft: null });

  const items = list.data?.items ?? [];
  const portfolios = list.data?.portfolios.filter((p) => p.count >= 2) ?? [];
  return (
    <>
      <Drawer visible={visible} onClose={onClose} keepMounted>
        <DrawerHeader
          title={t("intentions.title")}
          actions={[{ label: t("common.action.close"), onPress: onClose, variant: "secondary" }]}
        />
        <View testID="sheet-intentions" style={styles.body}>
          {isWaitingForNetwork(list) ? (
            // Not kept for offline reading: the figures are volatile and private, like the chat thread.
            <Text style={styles.emptyBody}>{t("errors.offlineNoData")}</Text>
          ) : list.isPending ? (
            Array.from({ length: SKELETON_ROWS }, (_, i) => <SkeletonBlock key={i} width="100%" height={SKELETON_HEIGHT} borderRadius={16} />)
          ) : list.isError ? (
            <View style={styles.empty}>
              <Text style={styles.emptyBody}>{t("intentions.loadError")}</Text>
              <PillButton label={t("common.action.retry")} variant="outline" onPress={() => void list.refetch()} />
            </View>
          ) : items.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{t("intentions.empty.title")}</Text>
              <Text style={styles.emptyBody}>{t("intentions.empty.body")}</Text>
            </View>
          ) : (
            <>
              {portfolios.map((portfolio) => (
                <IntentionPortfolioView key={portfolio.currency} portfolio={portfolio} testID="portfolio-intentions" />
              ))}
              {items.map((item) => (
                <IntentionRow key={item.id} item={item} onEdit={edit} onDelete={askDelete} />
              ))}
            </>
          )}
          {remove.isError ? <Text style={styles.error}>{errorText(remove.error, "intentions.error.delete")}</Text> : null}
          <PillButton label={t("intentions.add")} onPress={add} testID="btn-intention-add" />
        </View>
      </Drawer>

      <ConfirmDialog
        visible={Boolean(deleting?.open)}
        title={t("intentions.delete.title")}
        message={t("intentions.delete.body", { title: deleting?.item.title ?? "" })}
        confirmLabel={t("intentions.delete.confirm")}
        cancelLabel={t("common.action.keep")}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting((prev) => (prev ? { ...prev, open: false } : prev))}
        loading={remove.isPending}
      />
    </>
  );
}

const useStyles = createStyles((colors) => ({
  body: { gap: spacing.md },
  empty: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  emptyTitle: { ...typography.cardTitle, color: colors.textPrimary },
  emptyBody: { ...typography.label, color: colors.textSecondary, textAlign: "center" },
  error: { ...typography.caption, color: colors.peach },
}));
