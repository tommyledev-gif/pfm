import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { isAxiosError } from "axios";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { SearchField } from "@/components/ui/SearchField";
import { getErrorMessage, isNetworkError } from "@/lib/api-envelope";
import { useRequireOnline } from "@/lib/connectivity";
import { HTTP_STATUS } from "@/lib/constants";
import { createStyles, radii, spacing, typography, useColors } from "@/lib/theme";
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
    <View style={styles.section} testID="section-delete-accounts">
      <Text style={styles.title}>{TITLE}</Text>
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder={PLACEHOLDER}
        autoCorrect={false}
        testID="input-account-search"
      />

      {!hasQuery ? null : search.isPending ? (
        <ActivityIndicator style={styles.status} color={colors.textSecondary} />
      ) : search.isError && results.length === 0 ? (
        <View style={styles.failed}>
          <Text style={styles.statusText}>{SEARCH_FAILED}</Text>
          <Pressable onPress={() => search.refetch()} hitSlop={8} accessibilityRole="button">
            <Text style={styles.retry}>{RETRY}</Text>
          </Pressable>
        </View>
      ) : results.length === 0 ? (
        <Text style={[styles.status, styles.statusText]}>{NO_RESULTS}</Text>
      ) : (
        <View>
          {results.map((user) => (
            <AccountSearchRow
              key={user.id}
              user={user}
              deleting={remove.isPending && remove.variables === user.id}
              onDelete={setTarget}
            />
          ))}
        </View>
      )}

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
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  section: {
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
  },
  title: { ...typography.body, color: colors.textPrimary },
  status: { paddingVertical: spacing.sm },
  statusText: { ...typography.caption, color: colors.textSecondary },
  failed: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  retry: { ...typography.caption, fontWeight: "700", color: colors.textPrimary },
}));
