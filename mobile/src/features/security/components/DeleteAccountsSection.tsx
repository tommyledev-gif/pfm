import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text } from "react-native";
import { isAxiosError } from "axios";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ListCell, ListInlineButton, ListRow, ListSection } from "@/components/ui/grouped-list";
import { SearchField } from "@/components/ui/SearchField";
import { errorText, isNetworkError } from "@/lib/api-envelope";
import { copyOf, i18n } from "@/lib/i18n";
import { useRequireOnline } from "@/lib/connectivity";
import { HTTP_STATUS } from "@/lib/constants";
import { createStyles, typography, useColors } from "@/lib/theme";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useToastStore } from "@/stores/toast-store";
import { User } from "@/features/users/types";
import { useAccountSearchQuery } from "@/features/security/api/use-account-search-query";
import { useDeleteAccountMutation } from "@/features/security/api/use-delete-account-mutation";
import { AccountSearchRow } from "@/features/security/components/AccountSearchRow";

const COPY = copyOf({
  TITLE: "security.deleteAccounts.title",
  FOOTER: "security.deleteAccounts.footer",
  PLACEHOLDER: "security.deleteAccounts.placeholder",
  NO_RESULTS: "security.deleteAccounts.noResults",
  SEARCH_FAILED: "security.deleteAccounts.searchFailed",
  RETRY: "common.action.retry",
  CONFIRM_TITLE: "security.deleteAccounts.confirmTitle",
  CONFIRM_LABEL: "security.deleteAccounts.confirmLabel",
  CANCEL_LABEL: "common.action.keep",
  OFFLINE: "security.deleteAccounts.offline",
  NOT_FOUND: "security.deleteAccounts.notFound",
  FALLBACK_ERROR: "security.deleteAccounts.failed",
});
const SEARCH_DEBOUNCE_MS = 300;

const confirmMessage = (email: string) => i18n.t("security.deleteAccounts.confirmMessage", { email });
const successMessage = (email: string) => i18n.t("security.deleteAccounts.success", { email });

/**
 * The super admin's tool on Thành viên (it used to sit on Bảo mật): find any
 * account by email or tên đăng nhập, in this household or not, and
 * soft-delete it. Rendered only when GET /users/me says can_delete_accounts
 * (a super admin, mig 037); the server enforces the same on every call.
 */
export function DeleteAccountsSection() {
  useTranslation(); // COPY reads the current language: re-render on a switch
  const colors = useColors();
  const styles = useStyles();
  const requireOnline = useRequireOnline();
  const showToast = useToastStore((s) => s.show);
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<User | null>(null);
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const search = useAccountSearchQuery(debouncedQuery);
  const remove = useDeleteAccountMutation();
  const hasQuery = query.trim().length > 0;

  const confirm = () => {
    const user = target;
    setTarget(null);
    if (!user || remove.isPending) return;
    requireOnline(() =>
      remove.mutate(user.id, {
        onSuccess: () => showToast(successMessage(user.email), "info"),
        onError: (error) => {
          if (isNetworkError(error)) return showToast(COPY.OFFLINE, "warning");
          const notFound = isAxiosError(error) && error.response?.status === HTTP_STATUS.notFound;
          showToast(notFound ? COPY.NOT_FOUND : errorText(error, "security.deleteAccounts.failed"), "error");
        },
      }),
    );
  };

  const results = search.data ?? [];

  return (
    <>
      {/* One group: the search field as its first row, results under it. */}
      <ListSection header={COPY.TITLE} footer={COPY.FOOTER} testID="section-delete-accounts">
        <ListCell>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder={COPY.PLACEHOLDER}
            autoCorrect={false}
            testID="input-account-search"
          />
        </ListCell>

        {!hasQuery ? null : search.isPending ? (
          <ListCell>
            <ActivityIndicator color={colors.textSecondary} />
          </ListCell>
        ) : search.isError && results.length === 0 ? (
          <ListRow
            title={COPY.SEARCH_FAILED}
            trailing={<ListInlineButton label={COPY.RETRY} tone="default" onPress={() => search.refetch()} />}
          />
        ) : results.length === 0 ? (
          <ListCell>
            <Text style={styles.statusText}>{COPY.NO_RESULTS}</Text>
          </ListCell>
        ) : (
          results.map((user) => (
            <AccountSearchRow
              key={user.id}
              user={user}
              deleting={remove.isPending && remove.variables === user.id}
              onDelete={setTarget}
            />
          ))
        )}
      </ListSection>

      <ConfirmDialog
        visible={target !== null}
        title={COPY.CONFIRM_TITLE}
        message={confirmMessage(target?.email ?? "")}
        confirmLabel={COPY.CONFIRM_LABEL}
        cancelLabel={COPY.CANCEL_LABEL}
        onConfirm={confirm}
        onCancel={() => setTarget(null)}
        testID="dialog-delete-account"
      />
    </>
  );
}

const useStyles = createStyles((colors) => ({
  statusText: { ...typography.caption, fontWeight: "500", color: colors.textSecondary },
}));
