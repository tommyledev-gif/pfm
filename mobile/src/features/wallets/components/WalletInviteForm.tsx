import { useState } from "react";
import { View } from "react-native";

import { ListCell, ListSection, ListTextField } from "@/components/ui/grouped-list";
import { PillButton } from "@/components/ui/PillButton";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { useRequireOnline } from "@/lib/connectivity";
import { spacing, createStyles } from "@/lib/theme";
import { useInviteWalletMemberMutation } from "@/features/wallets/api/use-wallet-member-mutations";
import { WalletMemberRole } from "@/features/wallets/types";
import { ROLE_OPTIONS, inviteErrorMessage } from "@/features/wallets/components/wallet-member-copy";

const ROLE_HINT: Record<WalletMemberRole, string> = {
  editor: "Thêm được giao dịch vào ví này. Chỉ sửa được giao dịch mình ghi.",
  viewer: "Xem được số dư và giao dịch, không thêm được giao dịch.",
};

/**
 * The owner's "invite someone" group in the members sheet
 * (specs/shared-wallets US-01). The invitee answers from their own Wallets
 * screen; nothing is shared until they accept.
 */
export function WalletInviteForm({ walletId }: { walletId: string }) {
  const styles = useStyles();
  const requireOnline = useRequireOnline();
  const invite = useInviteWalletMemberMutation(walletId);
  const [identifier, setIdentifier] = useState("");
  const [role, setRole] = useState<WalletMemberRole>("editor");

  const trimmed = identifier.trim();
  const send = () =>
    requireOnline(() =>
      invite.mutate({ identifier: trimmed, role }, { onSuccess: () => setIdentifier("") }),
    );

  return (
    <ListSection
      header="Mời thêm người"
      footer={invite.isError ? inviteErrorMessage(invite.error) : ROLE_HINT[role]}
      footerTone={invite.isError ? "danger" : "default"}
    >
      <ListTextField
        label="Email hoặc tên đăng nhập"
        value={identifier}
        onChangeText={(text) => {
          setIdentifier(text);
          if (invite.isError) invite.reset();
        }}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        returnKeyType="send"
        onSubmitEditing={() => (trimmed.length >= 3 ? send() : undefined)}
        editable={!invite.isPending}
        invalid={invite.isError}
        testID="input-wallet-invite"
      />
      <ListCell>
        <View style={styles.controls}>
          <SegmentedTabs options={ROLE_OPTIONS} value={role} onChange={setRole} testID="tabs-wallet-invite-role" />
          <PillButton
            label="Gửi lời mời"
            onPress={send}
            loading={invite.isPending}
            disabled={trimmed.length < 3}
            testID="btn-wallet-invite-send"
          />
        </View>
      </ListCell>
    </ListSection>
  );
}

const useStyles = createStyles(() => ({
  controls: { gap: spacing.md, paddingVertical: spacing.sm },
}));
