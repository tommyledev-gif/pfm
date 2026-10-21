import { useState } from "react";
import { FlatList, View } from "react-native";

import { useListEntrance } from "@/components/motion/MotionView";
import { GroupedListCell, ListSection } from "@/components/ui/grouped-list";
import { useFabBottom } from "@/components/ui/Fab";
import { Screen } from "@/components/shared/Screen";
import { ScreenHeader, ScreenHeaderAction } from "@/components/shared/ScreenHeader";
import { spacing, createStyles } from "@/lib/theme";
import { useUsersQuery } from "@/features/users/api/use-users-query";
import { UserListItem } from "@/features/users/components/UserListItem";
import { UserListItemSkeleton } from "@/features/users/components/UserListItemSkeleton";
import { InviteUserModal } from "@/features/users/components/InviteUserModal";
import { UsersEmptyState } from "@/features/users/components/UsersEmptyState";

const LIST_SKELETON_COUNT = 4;

// Household Members screen — backend enforces admin-only access on
// GET/POST /admin/users* (403 for members); mobile does not add a
// client-side gate, same precedent as frontend/src/app/app/users/page.tsx.
//
// One grouped list: every member a row of the same rounded group.
export default function UsersScreen() {
  const styles = useStyles();
  const users = useUsersQuery();
  const [inviteOpen, setInviteOpen] = useState(false);
  // Clear of the floating BottomNav, so the last member is never under it.
  const navClearance = useFabBottom();
  // Rows stagger in once, when the list first has data; refetches keep the key.
  const enter = useListEntrance(users.isLoading ? "loading" : "ready");
  const list = users.data?.data ?? [];

  return (
    <Screen>
      <ScreenHeader
        title="Thành viên"
        trailing={
          <ScreenHeaderAction
            onPress={() => setInviteOpen(true)}
            accessibilityLabel="Mời thành viên"
            testID="btn-users-invite"
          />
        }
      />

      {users.isLoading ? (
        <View style={styles.list}>
          <ListSection>
            {Array.from({ length: LIST_SKELETON_COUNT }).map((_, i) => (
              <UserListItemSkeleton key={i} />
            ))}
          </ListSection>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(u) => u.id}
          contentContainerStyle={[styles.list, { paddingBottom: navClearance }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <GroupedListCell index={index} count={list.length} entering={enter(index)}>
              <UserListItem user={item} />
            </GroupedListCell>
          )}
          ListEmptyComponent={
            <UsersEmptyState
              failed={users.isError}
              onInvite={() => setInviteOpen(true)}
              onRetry={() => void users.refetch()}
            />
          }
        />
      )}

      <InviteUserModal visible={inviteOpen} onClose={() => setInviteOpen(false)} />
    </Screen>
  );
}

const useStyles = createStyles(() => ({
  list: { paddingHorizontal: spacing.xl },
}));
