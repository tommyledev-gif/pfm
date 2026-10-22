import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { CheckIcon, EditIcon, EyeIcon, UsersIcon } from "@/components/ui/Icon";
import { PillButton } from "@/components/ui/PillButton";
import { withAlpha } from "@/lib/color";
import { useRequireOnline } from "@/lib/connectivity";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useInviteWalletMemberMutation } from "@/features/wallets/api/use-wallet-member-mutations";
import { WalletMemberRole } from "@/features/wallets/types";
import {
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  WALLET_MEMBER_LIMIT,
  inviteErrorMessage,
} from "@/features/wallets/components/wallet-member-copy";

const ROLES: WalletMemberRole[] = ["editor", "viewer"];
const MIN_IDENTIFIER = 3;

interface WalletInviteFormProps {
  walletId: string;
  /** Live memberships besides the owner (pending + active), for the BR-02 cap. */
  memberCount: number;
}

/**
 * The owner's "invite someone" card in the members sheet
 * (specs/shared-wallets US-01). One field for email or tên đăng nhập, then
 * the role as two choices that each say what the person will be able to do
 * — the old two-word segmented control left that to a footnote nobody read.
 * The invitee answers from their own Ví chung tab; nothing is shared until
 * they accept. Locked once the wallet holds WALLET_MEMBER_LIMIT people.
 */
export function WalletInviteForm({ walletId, memberCount }: WalletInviteFormProps) {
  const colors = useColors();
  const styles = useStyles();
  const requireOnline = useRequireOnline();
  const invite = useInviteWalletMemberMutation(walletId);
  const [identifier, setIdentifier] = useState("");
  const [role, setRole] = useState<WalletMemberRole>("editor");
  const [focused, setFocused] = useState(false);

  const full = memberCount >= WALLET_MEMBER_LIMIT;
  const trimmed = identifier.trim();
  const canSend = !full && trimmed.length >= MIN_IDENTIFIER;
  const send = () =>
    requireOnline(() => invite.mutate({ identifier: trimmed, role }, { onSuccess: () => setIdentifier("") }));

  return (
    <View style={styles.card} testID="form-wallet-invite">
      <View style={styles.header}>
        <Text style={styles.title}>Mời thêm người</Text>
        <Text style={[styles.capacity, full && styles.capacityFull]}>
          {memberCount}/{WALLET_MEMBER_LIMIT}
        </Text>
      </View>

      <View
        style={[
          styles.field,
          focused && { borderColor: colors.green },
          invite.isError && { borderColor: colors.peach },
        ]}
      >
        <UsersIcon size={18} color={focused ? colors.green : colors.textMuted} />
        <TextInput
          style={styles.input}
          value={identifier}
          onChangeText={(text) => {
            setIdentifier(text);
            if (invite.isError) invite.reset();
          }}
          placeholder="Email hoặc tên đăng nhập"
          placeholderTextColor={colors.textMuted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          returnKeyType="send"
          onSubmitEditing={() => (canSend ? send() : undefined)}
          editable={!invite.isPending && !full}
          accessibilityLabel="Email hoặc tên đăng nhập"
          testID="input-wallet-invite"
        />
      </View>
      {invite.isError ? <Text style={styles.error}>{inviteErrorMessage(invite.error)}</Text> : null}

      <View style={styles.roles} accessibilityRole="radiogroup" testID="tabs-wallet-invite-role">
        {ROLES.map((value) => {
          const active = role === value;
          const Icon = value === "editor" ? EditIcon : EyeIcon;
          return (
            <Pressable
              key={value}
              onPress={() => setRole(value)}
              style={[styles.role, active && styles.roleActive]}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              testID={`option-wallet-invite-role-${value}`}
            >
              <View style={[styles.roleIcon, active && styles.roleIconActive]}>
                <Icon size={16} color={active ? colors.onGreen : colors.textSecondary} />
              </View>
              <View style={styles.roleTexts}>
                <Text style={styles.roleTitle}>{ROLE_LABEL[value]}</Text>
                <Text style={styles.roleHint}>{ROLE_DESCRIPTION[value]}</Text>
              </View>
              <View style={[styles.radio, active && styles.radioActive]}>
                {active ? <CheckIcon size={12} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {full ? <Text style={styles.full}>Ví đã đủ {WALLET_MEMBER_LIMIT} người. Xóa bớt người để mời thêm.</Text> : null}
      <PillButton
        label="Gửi lời mời"
        onPress={send}
        loading={invite.isPending}
        disabled={!canSend}
        testID="btn-wallet-invite-send"
      />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { ...typography.cardTitle, color: colors.textPrimary },
  capacity: { ...typography.caption, color: colors.textMuted },
  capacityFull: { color: colors.mustard },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.listCard,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.bgApp,
  },
  input: { flex: 1, ...typography.body, fontWeight: "500", color: colors.textPrimary, paddingVertical: spacing.md },
  error: { ...typography.caption, color: colors.peach, marginTop: -spacing.xs },
  roles: { gap: spacing.sm },
  role: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.listCard,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  roleActive: { borderColor: colors.green, backgroundColor: withAlpha(colors.green, 0.07) },
  roleIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(colors.overlayBase, 0.08),
  },
  roleIconActive: { backgroundColor: colors.green },
  roleTexts: { flex: 1, gap: 2 },
  roleTitle: { ...typography.body, color: colors.textPrimary },
  roleHint: { ...typography.caption, color: colors.textSecondary },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { backgroundColor: colors.green, borderColor: colors.green },
  full: { ...typography.caption, color: colors.mustard },
}));
