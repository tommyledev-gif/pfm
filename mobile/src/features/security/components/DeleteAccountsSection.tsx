import { useState } from "react";
import { ActivityIndicator, Text } from "react-native";
import { isAxiosError } from "axios";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ListCell, ListInlineButton, ListRow, ListSection } from "@/components/ui/grouped-list";
import { SearchField } from "@/components/ui/SearchField";
import { getErrorMessage, isNetworkError } from "@/lib/api-envelope";
import { useRequireOnline } from "@/lib/connectivity";
import { HTTP_STATUS } from "@/lib/constants";
import { createStyles, typography, useColors } from "@/lib/theme";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useToastStore } from "@/stores/toast-store";
import { User } from "@/features/users/types";
import { useAccountSearchQuery } from "@/features/security/api/use-account-search-query";
import { useDeleteAccountMutation } from "@/features/security/api/use-delete-account-mutation";
import { AccountSearchRow } from "@/features/security/components/AccountSearchRow";

const TITLE = "Xóa tài khoản";
const PLACEHOLDER = "Tìm theo email, tên đăng nhập";
const NO_RESULTS = "Không tìm thấy tài khoản";
const SEARCH_FAILED = "Chưa tải được kết quả.";
const RETRY = "Thử lại";
const CONFIRM_TITLE = "Xóa tài khoản này?";
const CONFIRM_LABEL = "Xóa tài khoản";
const CANCEL_LABEL = "Giữ lại";
const OFFLINE = "Cần kết nối mạng để xóa tài khoản.";
const NOT_FOUND = "Không tìm thấy tài khoản.";
const FALLBACK_ERROR = "Chưa xóa được tài khoản. Thử lại.";
const SEARCH_DEBOUNCE_MS = 300;

const confirmMessage = (email: string) =>
  `${email} bị đăng xuất khỏi mọi thiết bị và không đăng nhập lại được. Không thể hoàn tác.`;
const successMessage = (email: string) => `Đã xóa tài khoản ${email}`;

/**
 * Test-phase tool on the Security screen: find any account by email or tên
 * đăng nhập and soft-delete it. Rendered only for
 * ACCOUNT_DELETION_OPERATOR_EMAIL; the server enforces the same.
 */
export function DeleteAccountsSection() {
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
          if (isNetworkError(error)) return showToast(OFFLINE, "warning");
          const notFound = isAxiosError(error) && error.response?.status === HTTP_STATUS.notFound;
          showToast(notFound ? NOT_FOUND : getErrorMessage(error, FALLBACK_ERROR), "error");
        },
      }),
    );
  };

  const results = search.data ?? [];

  return (
    <>
      {/* One group: the search field as its first row, results under it. */}
      <ListSection header={TITLE} testID="section-delete-accounts">
        <ListCell>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder={PLACEHOLDER}
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
            title={SEARCH_FAILED}
            trailing={<ListInlineButton label={RETRY} tone="default" onPress={() => search.refetch()} />}
          />
        ) : results.length === 0 ? (
          <ListCell>
            <Text style={styles.statusText}>{NO_RESULTS}</Text>
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
        title={CONFIRM_TITLE}
        message={confirmMessage(target?.email ?? "")}
        confirmLabel={CONFIRM_LABEL}
        cancelLabel={CANCEL_LABEL}
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
