"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBanner } from "@/components/shared/error-banner";
import { useSetDefaultWalletMutation } from "@/features/wallets/api/use-set-default-wallet-mutation";
import { EditWalletDialog } from "@/features/wallets/components/edit-wallet-dialog";
import type { Wallet } from "@/features/wallets/types";
import { formatCurrency } from "@/lib/currency";

interface WalletDetailCardProps {
  wallet: Wallet;
}

export function WalletDetailCard({ wallet }: WalletDetailCardProps) {
  const { mutate: setDefaultWallet, isPending, error } = useSetDefaultWalletMutation();

  return (
    <Card data-testid="card-wallet-detail">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <CardTitle>{wallet.name}</CardTitle>
          {wallet.is_default && <Badge variant="default">Default</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <EditWalletDialog wallet={wallet} />
          <Button
            data-testid="btn-set-default-wallet"
            variant="outline"
            size="sm"
            disabled={wallet.is_default || isPending}
            onClick={() => setDefaultWallet(wallet.id)}
          >
            {isPending ? "Setting..." : "Set as default"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && <ErrorBanner message="Could not set this wallet as default. Try again." />}
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Type</dt>
          <dd className="capitalize">{wallet.type.replace("_", " ")}</dd>
          <dt className="text-muted-foreground">Currency</dt>
          <dd>{wallet.currency}</dd>
          <dt className="text-muted-foreground">Balance</dt>
          <dd>{formatCurrency(wallet.balance, wallet.currency)}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}
