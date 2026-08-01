"use client";

import { ErrorBanner } from "@/components/shared/error-banner";
import { PageHeader } from "@/components/shared/page-header";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { CreateWalletDialog } from "@/features/wallets/components/create-wallet-dialog";
import { WalletTable } from "@/features/wallets/components/wallet-table";
import { WalletTableSkeleton } from "@/features/wallets/components/wallet-table-skeleton";

export default function WalletsPage() {
  const { data, isLoading, isError } = useWalletsQuery();

  return (
    <div>
      <PageHeader
        title="Wallets"
        description="Sources and destinations of money — cash, bank accounts, e-wallets."
        actions={<CreateWalletDialog />}
      />

      {isError && <ErrorBanner message="Failed to load wallets." />}
      {isLoading && <WalletTableSkeleton />}
      {!isLoading && data && <WalletTable wallets={data.data} />}
    </div>
  );
}
