import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { ChevronLeftIcon, PlusIcon } from "@/components/ui/Icon";
import { Screen } from "@/components/shared/Screen";
import { WALLET_TYPES, WalletType } from "@/lib/constants";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { Wallet } from "@/features/wallets/types";
import { WalletFormModal } from "@/features/wallets/components/WalletFormModal";
import { WalletListItem } from "@/features/wallets/components/WalletListItem";

const TYPE_LABEL: Record<WalletType, string> = {
  cash: "Tiền mặt",
  bank: "Ngân hàng",
  e_wallet: "Ví điện tử",
  other: "Khác",
};

interface WalletSection {
  type: WalletType;
  title: string;
  data: Wallet[];
}

export default function WalletsScreen() {
  const router = useRouter();
  const wallets = useWalletsQuery();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);

  // GET /wallets orders `is_default DESC, created_at ASC` (backend/db/queries
  // /wallets.sql) — fine for a flat list, but it means every wallet visibly
  // jumps to the top the moment it becomes the new default. Re-sorted here by
  // created_at only (is_default never enters the comparison), then grouped by
  // type, so changing the default flips just the "Mặc định" badge and nothing
  // about position or grouping.
  const sections = useMemo<WalletSection[]>(() => {
    const byType = new Map<WalletType, Wallet[]>();
    const stableOrder = [...(wallets.data ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (const wallet of stableOrder) {
      const group = byType.get(wallet.type) ?? [];
      group.push(wallet);
      byType.set(wallet.type, group);
    }
    return WALLET_TYPES.map((type) => ({ type, title: TYPE_LABEL[type], data: byType.get(type) ?? [] })).filter(
      (section) => section.data.length > 0,
    );
  }, [wallets.data]);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon size={24} />
        </Pressable>
        <Text style={styles.title}>Ví tiền</Text>
        <Pressable
          style={styles.addButton}
          onPress={() => {
            setEditingWallet(null);
            setModalOpen(true);
          }}
          hitSlop={8}
        >
          <PlusIcon size={16} color={colors.onGreen} />
        </Pressable>
      </View>

      {wallets.isLoading ? (
        <ActivityIndicator color={colors.green} style={styles.loader} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(w) => w.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          SectionSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderLabel}>{section.title}</Text>
              <Text style={styles.sectionHeaderCount}>{section.data.length}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <WalletListItem
              wallet={item}
              onPress={() => {
                setEditingWallet(item);
                setModalOpen(true);
              }}
            />
          )}
          ListEmptyComponent={<Text style={styles.empty}>Chưa có ví nào — nhấn + để tạo ví mới.</Text>}
        />
      )}

      <WalletFormModal visible={modalOpen} onClose={() => setModalOpen(false)} editingWallet={editingWallet} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: { flex: 1, ...typography.title, color: colors.textPrimary },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { paddingHorizontal: spacing.xl, paddingBottom: 140 },
  loader: { marginTop: spacing.xxl },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  sectionHeaderLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sectionHeaderCount: { ...typography.tiny, color: colors.textMuted },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
});
