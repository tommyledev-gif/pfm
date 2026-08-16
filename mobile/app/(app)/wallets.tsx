import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { ChevronLeftIcon, PlusIcon } from "@/components/ui/Icon";
import { Screen } from "@/components/shared/Screen";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { Wallet } from "@/features/wallets/types";
import { WalletFormModal } from "@/features/wallets/components/WalletFormModal";
import { WalletListItem } from "@/features/wallets/components/WalletListItem";

export default function WalletsScreen() {
  const router = useRouter();
  const wallets = useWalletsQuery();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon size={24} />
        </Pressable>
        <Text style={styles.title}>Wallets</Text>
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
        <FlatList
          data={wallets.data ?? []}
          keyExtractor={(w) => w.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item }) => (
            <WalletListItem
              wallet={item}
              onPress={() => {
                setEditingWallet(item);
                setModalOpen(true);
              }}
            />
          )}
          ListEmptyComponent={<Text style={styles.empty}>No wallets yet — tap + to create one.</Text>}
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
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  loader: { marginTop: spacing.xxl },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
});
