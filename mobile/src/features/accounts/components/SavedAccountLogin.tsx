import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ChevronLeftIcon } from "@/components/ui/Icon";
import { createStyles, spacing, useColors } from "@/lib/theme";
import { useKeyboardHeight } from "@/lib/use-keyboard-height";
import { useAccessRequestStore } from "@/features/auth/access-request-store";
import { BrandMark } from "@/features/auth/components/BrandMark";
import { REMOVE_ACCOUNT_COPY } from "@/features/accounts/account-copy";
import { CandidateSignIn } from "@/features/accounts/components/CandidateSignIn";
import { CandidateRow } from "@/features/accounts/components/LoginCandidateViews";
import { candidateName, LoginCandidate } from "@/features/accounts/login-candidates";
import { removeSavedAccount } from "@/features/accounts/remove-account";

const COPY = {
  back: "Quay lại",
  pick: "Chọn tài khoản",
  // A sent request is not an account yet: removing it here cancels nothing.
  removeRequestMessage: "Yêu cầu đã gửi không bị hủy.",
} as const;

interface SavedAccountLoginProps {
  /** Everyone to offer (useLoginCandidates), at least one. */
  candidates: LoginCandidate[];
  /** Back to the email and password form. */
  onBack: () => void;
  onDone: () => void;
}

/**
 * The login screen's saved-accounts view, opened from its "Tài khoản đã lưu"
 * row. One person: straight to their way in (CandidateSignIn). Several: the
 * list first, then the chosen one, with back returning to the list. Each
 * saved account or sent request can be removed from the device (after a
 * confirm); a test account cannot.
 */
export function SavedAccountLogin({ candidates, onBack, onDone }: SavedAccountLoginProps) {
  const colors = useColors();
  const styles = useStyles();
  const keyboardHeight = useKeyboardHeight();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<LoginCandidate | null>(null);
  const single = candidates.length === 1;
  // A chosen person who has just been removed falls back to the list.
  const selected = single ? candidates[0] : candidates.find((c) => c.key === selectedKey);

  // The last one removed: nothing left to show here.
  useEffect(() => {
    if (candidates.length === 0) onBack();
  }, [candidates.length, onBack]);

  const back = () => (selected && !single ? setSelectedKey(null) : onBack());
  const removable = (candidate: LoginCandidate) => (candidate.kind === "test" ? undefined : () => setPendingRemoval(candidate));

  const remove = async () => {
    const target = pendingRemoval;
    setPendingRemoval(null);
    if (target?.kind === "saved") {
      await removeSavedAccount(target.account.userId);
    } else if (target?.kind === "requested") {
      useAccessRequestStore.getState().remove(target.email);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + keyboardHeight }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable
            onPress={back}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel={COPY.back}
            testID="btn-login-saved-back"
          >
            <ChevronLeftIcon size={24} color={colors.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.column}>
          <BrandMark />
          {selected ? (
            <View style={styles.body}>
              <CandidateSignIn key={selected.key} candidate={selected} onDone={onDone} onRemove={removable(selected)} />
            </View>
          ) : (
            <View style={styles.body}>
              <Text style={styles.title} accessibilityRole="header">{COPY.pick}</Text>
              <View style={styles.list}>
                {candidates.map((candidate) => (
                  <CandidateRow
                    key={candidate.key}
                    candidate={candidate}
                    onPress={() => setSelectedKey(candidate.key)}
                    onRemove={removable(candidate)}
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={pendingRemoval !== null}
        title={pendingRemoval ? REMOVE_ACCOUNT_COPY.title(candidateName(pendingRemoval)) : ""}
        message={pendingRemoval?.kind === "requested" ? COPY.removeRequestMessage : REMOVE_ACCOUNT_COPY.message}
        confirmLabel={REMOVE_ACCOUNT_COPY.confirm}
        cancelLabel={REMOVE_ACCOUNT_COPY.cancel}
        onConfirm={remove}
        onCancel={() => setPendingRemoval(null)}
        testID="dialog-login-remove-account"
      />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.bgApp },
  content: { flexGrow: 1, paddingHorizontal: spacing.xxl, paddingTop: spacing.md },
  header: { minHeight: 44, flexDirection: "row", alignItems: "center" },
  back: { width: 44, height: 44, marginLeft: -10, alignItems: "center", justifyContent: "center" },
  // Centred in what is left under the header, like the login form's column.
  column: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center", paddingBottom: 44 },
  body: { width: "100%", marginTop: 40 },
  title: { fontSize: 20, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing.md },
  list: { gap: spacing.sm },
}));
