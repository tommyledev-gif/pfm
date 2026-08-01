"use client";

import { useParams } from "next/navigation";

import { ErrorBanner } from "@/components/shared/error-banner";
import { PageHeader } from "@/components/shared/page-header";
import { useWalletQuery } from "@/features/wallets/api/use-wallet-query";
import { WalletDetailCard } from "@/features/wallets/components/wallet-detail-card";
import { WalletDetailCardSkeleton } from "@/features/wallets/components/wallet-detail-card-skeleton";

export default function WalletDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, isLoading, isError } = useWalletQuery(params.id);

  return (
    <div>
      <PageHeader title="Wallet details" />

      {isError && (
        <ErrorBanner message="Failed to load this wallet — it may not exist or you may not have access to it." />
      )}
      {isLoading && <WalletDetailCardSkeleton />}
      {!isLoading && data && <WalletDetailCard wallet={data} />}
    </div>
  );
}
