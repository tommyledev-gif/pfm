import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { EmptyIllustration } from "@/components/shared/EmptyIllustration";
import { EmptyStateCard } from "@/components/shared/EmptyState";
import { HistoryIcon, ReceiptIcon } from "@/components/ui/Icon";
import { useColors } from "@/lib/theme";

/**
 * The transaction log before anything has been recorded. The log itself is
 * read-only, so its one action leads to where changes are made.
 */
export function AuditLogsEmptyState() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  return (
    <EmptyStateCard
      testID="empty-audit-logs"
      illustration={
        <EmptyIllustration>
          <HistoryIcon size={30} color={colors.green} />
        </EmptyIllustration>
      }
      title={t("auditLogs.empty.title")}
      description={t("auditLogs.empty.body")}
      action={{
        label: t("auditLogs.empty.cta"),
        icon: <ReceiptIcon size={18} color={colors.onGreen} />,
        onPress: () => router.navigate("/transactions"),
        testID: "btn-empty-audit-logs-transactions",
      }}
    />
  );
}
