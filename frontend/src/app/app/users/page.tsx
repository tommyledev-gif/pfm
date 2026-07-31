"use client";

import { PageHeader } from "@/components/shared/page-header";
import { ErrorBanner } from "@/components/shared/error-banner";
import { useUsersQuery } from "@/features/users/api/use-users-query";
import { InviteUserDialog } from "@/features/users/components/invite-user-dialog";
import { UserTable } from "@/features/users/components/user-table";
import { UserTableSkeleton } from "@/features/users/components/user-table-skeleton";

export default function UsersPage() {
  const { data, isLoading, isError } = useUsersQuery();

  return (
    <div>
      <PageHeader
        title="Users"
        description="Invite-only accounts — invited users get an activation email."
        actions={<InviteUserDialog />}
      />

      {isError && <ErrorBanner message="Failed to load users." />}
      {isLoading && <UserTableSkeleton />}
      {!isLoading && data && <UserTable users={data.data} />}
    </div>
  );
}
