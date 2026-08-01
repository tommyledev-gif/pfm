import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/lib/constants";
import { formatCurrency } from "@/lib/currency";
import type { Wallet } from "@/features/wallets/types";

interface WalletTableProps {
  wallets: Wallet[];
}

export function WalletTable({ wallets }: WalletTableProps) {
  if (wallets.length === 0) {
    return (
      <p data-testid="text-wallets-empty" className="py-8 text-center text-sm text-muted-foreground">
        No wallets yet — create one to start recording transactions.
      </p>
    );
  }

  return (
    <Table data-testid="table-wallets">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Currency</TableHead>
          <TableHead>Balance</TableHead>
          <TableHead>Default</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {wallets.map((wallet) => (
          <TableRow key={wallet.id}>
            <TableCell className="font-medium">
              <Link href={`${ROUTES.wallets}/${wallet.id}`} className="hover:underline">
                {wallet.name}
              </Link>
            </TableCell>
            <TableCell className="capitalize">{wallet.type.replace("_", " ")}</TableCell>
            <TableCell>{wallet.currency}</TableCell>
            <TableCell>{formatCurrency(wallet.balance, wallet.currency)}</TableCell>
            <TableCell>
              {wallet.is_default && (
                <Badge data-testid="badge-wallet-default" variant="default">
                  Default
                </Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
