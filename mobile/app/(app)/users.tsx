import { useMemo, useState } from "react";
import { ActivityIndicator, SectionList, View } from "react-native";

import { useListEntrance } from "@/components/motion/MotionView";
import { GroupedListCell, ListSection, ListSectionHeader } from "@/components/ui/grouped-list";
import { Fab, useFabClearance } from "@/components/ui/Fab";
import { SearchField } from "@/components/ui/SearchField";
import { Screen } from "@/components/shared/Screen";
import { ScreenHeader } from "@/components/shared/ScreenHeader";
import { matchesSearch } from "@/lib/search-text";
import { spacing, createStyles, useColors } from "@/lib/theme";
import { useProfileQuery } from "@/features/profile/api/use-profile-query";
import { DeleteAccountsSection } from "@/features/security/components/DeleteAccountsSection";
import { useUsersQuery } from "@/features/users/api/use-users-query";
import { User } from "@/features/users/types";
import { STATUS_LABEL, UserListItem } from "@/features/users/components/UserListItem";
import { UserListItemSkeleton } from "@/features/users/components/UserListItemSkeleton";
import { InviteUserModal } from "@/features/users/components/InviteUserModal";
import { UsersEmptyState } from "@/features/users/components/UsersEmptyState";

const LIST_SKELETON_COUNT = 4;
// The search field shows once the list is long enough to need it.
const SEARCH_FROM = 6;
// What needs the admin's hand first: requests to approve, then invitations
// not yet taken up, then everyone using the app, then locked accounts.
const STATUS_ORDER: User["status"][] = ["requested", "pending", "active", "disabled"];

interface UserSection {
  key: User["status"];
  title: string;
  data: User[];
}

// Household Members screen — backend enforces admin-only access on
// GET/POST /admin/users* (403 for members); mobile does not add a
// client-side gate, same precedent as frontend/src/app/app/users/page.tsx.
//
// Grouped by status, so the rows asking for action sit on top; a search once
// the household is big enough; inviting is the Fab. A super admin also gets
// "Tất cả tài khoản" on top: any account, outside the household too, found
// and soft-deleted (DeleteAccountsSection).
export default function UsersScreen() {
  const colors = useColors();
  const styles = useStyles();
  const users = useUsersQuery();
  // The server says who is a super admin (GET /users/me); the app carries no email.
  const isSuperAdmin = useProfileQuery().data?.can_delete_accounts === true;
  const [inviteOpen, setInviteOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Clear of the floating BottomNav and the Fab, so the last member is never under them.
  const clearance = useFabClearance();
  // Rows stagger in once, when the list first has data; refetches keep the key.
  const enter = useListEntrance(users.isLoading ? "loading" : "ready");
  const list = useMemo(() => users.data?.pages.flatMap((page) => page.data) ?? [], [users.data]);
  // Everyone, not only the pages loaded so far (the server's count, first page).
  const total = users.data?.pages[0]?.pagination.total ?? list.length;
  const loadMore = () => {
    if (users.hasNextPage && !users.isFetchingNextPage) void users.fetchNextPage();
  };

  const sections = useMemo<UserSection[]>(() => {
    // Case and accents ignored: "tuan" finds "Tuấn".
    const matches = list.filter((u) => matchesSearch(`${u.full_name ?? ""} ${u.email} ${u.username ?? ""}`, query));
    return STATUS_ORDER.map((status) => ({
      key: status,
      title: STATUS_LABEL[status],
      data: matches.filter((u) => u.status === status),
    })).filter((section) => section.data.length > 0);
  }, [list, query]);

  const invite = () => setInviteOpen(true);

  return (
    <Screen>
      <ScreenHeader title="Thành viên" subtitle={users.data ? `${total} người` : undefined} />

      {list.length >= SEARCH_FROM ? (
        <View style={styles.search}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Tìm theo tên hoặc email"
            autoCorrect={false}
            testID="input-users-search"
          />
        </View>
      ) : null}

      {users.isLoading ? (
        <View style={styles.list}>
          <ListSection>
            {Array.from({ length: LIST_SKELETON_COUNT }).map((_, i) => (
              <UserListItemSkeleton key={i} />
            ))}
          </ListSection>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(u) => u.id}
          contentContainerStyle={[styles.list, { paddingBottom: clearance }]}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          // With the account search's keyboard open, the first tap on [Xóa]
          // has to reach the row, not just close the keyboard.
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            isSuperAdmin ? (
              <View style={styles.allAccounts}>
                <DeleteAccountsSection />
              </View>
            ) : null
          }
          renderSectionHeader={({ section }) => <ListSectionHeader title={`${section.title} · ${section.data.length}`} />}
          SectionSeparatorComponent={() => <View style={styles.sectionGap} />}
          renderItem={({ item, index, section }) => (
            <GroupedListCell index={index} count={section.data.length} entering={enter(index)}>
              <UserListItem user={item} />
            </GroupedListCell>
          )}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListFooterComponent={
            users.isFetchingNextPage ? <ActivityIndicator color={colors.textMuted} style={styles.more} /> : null
          }
          ListEmptyComponent={
            query ? null : (
              <UsersEmptyState failed={users.isError} onInvite={invite} onRetry={() => void users.refetch()} />
            )
          }
        />
      )}

      {/* Before the sheet, so its overlay covers the button. */}
      <Fab onPress={invite} accessibilityLabel="Mời thành viên" testID="btn-users-invite" />

      <InviteUserModal visible={inviteOpen} onClose={() => setInviteOpen(false)} />
    </Screen>
  );
}

const useStyles = createStyles(() => ({
  search: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  list: { paddingHorizontal: spacing.xl },
  sectionGap: { height: spacing.sm },
  more: { paddingVertical: spacing.lg },
  allAccounts: { paddingBottom: spacing.xl },
}));
