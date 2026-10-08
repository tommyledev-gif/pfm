import { ReactNode, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { EmptyIllustration } from "@/components/shared/EmptyIllustration";
import { EmptyStateCard } from "@/components/shared/EmptyState";
import { ThemedIllustration } from "@/components/shared/ThemedIllustration";
import { Chip } from "@/components/ui/Chip";
import {
  ChevronRightIcon,
  CloseIcon,
  PlusIcon,
  SearchIcon,
  SparkleIcon,
  TagIcon,
  WalletIcon,
} from "@/components/ui/Icon";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useTransactionsQuery } from "@/features/transactions/api/use-transactions-query";
import { Transaction } from "@/features/transactions/types";
import { useNeedsFirstWallet, useOpenWalletCreator } from "@/features/wallets/use-open-wallet-creator";

const MAX_SUGGESTIONS = 4;
// Longer notes are sentences, not search terms — and would not fit a chip.
const MAX_SUGGESTION_LENGTH = 24;
// The same request Home makes for its recent list, so this is usually cached.
const SUGGESTION_SOURCE = { limit: 10 };

/** The account has no transactions at all — nothing is being filtered out. */
export function NoTransactionsState({ onAdd }: { onAdd: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const openWalletCreator = useOpenWalletCreator();
  // A transaction has to land in a wallet, so with none the first step is
  // that one — the form would only have an empty wallet picker to offer.
  const needsWallet = useNeedsFirstWallet();

  return (
    <View style={styles.stack} testID="empty-transactions-none">
      <EmptyStateCard
        illustration={<ThemedIllustration name="transactions" />}
        title="Chưa có giao dịch nào"
        // No wallet is the one thing the title does not already say.
        description={needsWallet ? "Chưa có ví. Tạo ví để ghi giao dịch." : undefined}
        action={
          needsWallet
            ? {
                label: "Tạo ví",
                icon: <WalletIcon size={18} color={colors.onGreen} />,
                onPress: openWalletCreator,
                testID: "btn-empty-create-wallet",
              }
            : {
                label: "Thêm giao dịch",
                icon: <PlusIcon size={18} color={colors.onGreen} />,
                onPress: onAdd,
                testID: "btn-empty-add-transaction",
              }
        }
      />
      <View style={styles.tiles}>
        <ShortcutTile
          icon={<SparkleIcon size={18} />}
          eyebrow="Ghi bằng AI"
          label="Nhắn “Cà phê 50k”"
          onPress={() => router.navigate("/ai-chat")}
        />
        <ShortcutTile
          icon={<TagIcon size={18} color={colors.green} />}
          eyebrow="Danh mục"
          label="Tuỳ chỉnh danh mục"
          onPress={() => router.push("/categories")}
        />
      </View>
    </View>
  );
}

interface NoResultsStateProps {
  onClearFilters: () => void;
  /** Search for a suggested term, every other filter cleared. */
  onSearch: (text: string) => void;
}

/** The account has transactions, but none match the filters on screen. */
export function NoResultsState({ onClearFilters, onSearch }: NoResultsStateProps) {
  const colors = useColors();
  const styles = useStyles();
  // Search only matches notes (backend transactions.sql), so a generic
  // keyword list would mostly find nothing. Notes this account actually
  // wrote are guaranteed hits.
  const recent = useTransactionsQuery(SUGGESTION_SOURCE);
  const firstPage = recent.data?.pages[0]?.data;
  const suggestions = useMemo(() => noteSuggestions(firstPage ?? []), [firstPage]);

  return (
    <View style={styles.stack} testID="empty-transactions-filtered">
      <EmptyStateCard
        illustration={
          <EmptyIllustration
            badge={<CloseIcon size={11} color={colors.onGreen} strokeWidth={2.8} />}
            badgeColor={colors.peach}
          >
            <SearchIcon size={30} color={colors.green} />
          </EmptyIllustration>
        }
        title="Không tìm thấy giao dịch"
        description="Thử từ khóa khác."
        action={{
          label: "Xóa bộ lọc",
          icon: <CloseIcon size={16} color={colors.onGreen} strokeWidth={2.4} />,
          onPress: onClearFilters,
          testID: "btn-empty-clear-filters",
        }}
      />
      {suggestions.length > 0 ? (
        <View style={styles.suggestions}>
          <Text style={styles.suggestionsTitle}>Gợi ý từ ghi chú gần đây</Text>
          <View style={styles.chips}>
            {suggestions.map((note) => (
              <Chip key={note} label={note} onPress={() => onSearch(note)} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function noteSuggestions(transactions: Transaction[]): string[] {
  const seen = new Set<string>();
  const notes: string[] = [];
  for (const transaction of transactions) {
    const note = transaction.note?.trim();
    if (!note || note.length > MAX_SUGGESTION_LENGTH || seen.has(note.toLowerCase())) continue;
    seen.add(note.toLowerCase());
    notes.push(note);
    if (notes.length === MAX_SUGGESTIONS) break;
  }
  return notes;
}

interface ShortcutTileProps {
  icon: ReactNode;
  eyebrow: string;
  label: string;
  onPress: () => void;
}

function ShortcutTile({ icon, eyebrow, label, onPress }: ShortcutTileProps) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}>
      <View style={styles.tileIcon}>{icon}</View>
      <View style={styles.tileText}>
        <Text style={styles.tileEyebrow} numberOfLines={1}>
          {eyebrow}
        </Text>
        <Text style={styles.tileLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <ChevronRightIcon size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  stack: { gap: spacing.md, marginTop: spacing.sm },
  // Stacked, one shortcut per row — side by side, each label had half the
  // width and was cut off on a narrow phone.
  tiles: { gap: spacing.sm },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.listCard,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  tilePressed: { opacity: 0.75 },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
  tileText: { flex: 1, minWidth: 0 },
  tileEyebrow: { ...typography.tiny, color: colors.green },
  tileLabel: { ...typography.caption, color: colors.textPrimary },
  suggestions: { gap: spacing.sm, marginTop: spacing.sm },
  suggestionsTitle: { ...typography.caption, color: colors.textSecondary },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
}));
