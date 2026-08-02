"use client";

import { useState } from "react";

import { ErrorBanner } from "@/components/shared/error-banner";
import { PageHeader } from "@/components/shared/page-header";
import { useTransactionsQuery } from "@/features/transactions/api/use-transactions-query";
import { CreateTransactionDialog } from "@/features/transactions/components/create-transaction-dialog";
import { TransactionFiltersBar } from "@/features/transactions/components/transaction-filters";
import { TransactionTable } from "@/features/transactions/components/transaction-table";
import { TransactionTableSkeleton } from "@/features/transactions/components/transaction-table-skeleton";
import type { TransactionFilters } from "@/features/transactions/types";

export default function TransactionsPage() {
  const [filters, setFilters] = useState<TransactionFilters>({});
  const { data, isLoading, isError, hasNextPage, isFetchingNextPage, fetchNextPage } = useTransactionsQuery(filters);

  const transactions = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div>
      <PageHeader
        title="Transactions"
        description="Record and review your income and expenses."
        actions={<CreateTransactionDialog />}
      />

      <TransactionFiltersBar filters={filters} onChange={setFilters} />

      {isError && <ErrorBanner message="Failed to load transactions." />}
      {isLoading && <TransactionTableSkeleton />}
      {!isLoading && data && (
        <TransactionTable
          transactions={transactions}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={() => fetchNextPage()}
        />
      )}
    </div>
  );
}
