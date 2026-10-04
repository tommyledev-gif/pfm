import { Text, View } from "react-native";

import { createStyles, spacing, typography } from "@/lib/theme";
import { isAccountExpired, useAccountRegistryStore } from "@/features/accounts/account-registry-store";
import { AccountRow } from "@/features/accounts/components/AccountRow";
import { switchToAccount } from "@/features/accounts/switch-account";
import { SavedAccount } from "@/features/accounts/types";

interface ContinueAsListProps {
  /** An expired row was tapped — prefill the form below with its email. */
  onPrefill: (email: string) => void;
}

const HEADING = "Tiếp tục với…";

/**
 * Login screen chooser (spec US-05): every account saved on this device,
 * nothing fetched from the server (EC-14). A valid row switches in without a
 * password (identity check first); an expired one prefills the form.
 */
export function ContinueAsList({ onPrefill }: ContinueAsListProps) {
  const styles = useStyles();
  const accounts = useAccountRegistryStore((s) => s.accounts);
  const ordered = [...accounts].sort((a, b) => Date.parse(b.lastUsedAt) - Date.parse(a.lastUsedAt));

  const pick = (account: SavedAccount) => {
    if (isAccountExpired(account)) {
      onPrefill(account.email);
      return;
    }
    switchToAccount(account.userId)
      .then((outcome) => {
        if (outcome === "expired") onPrefill(account.email);
      })
      .catch(() => {});
  };

  if (ordered.length === 0) return null;

  return (
    <View style={styles.container} testID="list-login-continue-as">
      <Text style={styles.heading}>{HEADING}</Text>
      {ordered.map((account, index) => (
        <View key={account.userId} style={index > 0 ? styles.divided : undefined}>
          <AccountRow account={account} isActive={false} onPress={pick} testID={`row-continue-as-${account.userId}`} />
        </View>
      ))}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  container: { width: "100%" },
  heading: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
  divided: { borderTopWidth: 1, borderTopColor: colors.surfaceBorder },
}));
