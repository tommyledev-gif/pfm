import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeleteTransactionDialog } from "@/features/transactions/components/delete-transaction-dialog";
import { EditTransactionDialog } from "@/features/transactions/components/edit-transaction-dialog";
import type { Transaction } from "@/features/transactions/types";
import { formatCurrency } from "@/lib/currency";

interface TransactionTableProps {
  transactions: Transaction[];
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore: () => void;
}

export function TransactionTable({ transactions, hasNextPage, isFetchingNextPage, onLoadMore }: TransactionTableProps) {
  if (transactions.length === 0) {
    return (
      <p data-testid="text-transactions-empty" className="py-8 text-center text-sm text-muted-foreground">
        No transactions yet — record one to start tracking your activity.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Table data-testid="table-transactions">
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Wallet</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => (
            <TableRow key={transaction.id}>
              <TableCell>{new Date(transaction.occurred_at).toLocaleDateString()}</TableCell>
              <TableCell>{transaction.wallet_name}</TableCell>
              <TableCell>{transaction.category_name}</TableCell>
              <TableCell>
                <Badge variant={transaction.type === "expense" ? "destructive" : "secondary"}>{transaction.type}</Badge>
              </TableCell>
              <TableCell className="text-right">{formatCurrency(transaction.amount)}</TableCell>
              <TableCell className="flex justify-end gap-2">
                <EditTransactionDialog transaction={transaction} />
                <DeleteTransactionDialog transaction={transaction} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            data-testid="btn-transactions-load-more"
            variant="outline"
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
