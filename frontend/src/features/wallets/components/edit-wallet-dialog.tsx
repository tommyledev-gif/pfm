"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ErrorBanner } from "@/components/shared/error-banner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateWalletMutation } from "@/features/wallets/api/use-update-wallet-mutation";
import type { Wallet } from "@/features/wallets/types";
import { WALLET_NAME_MAX_LENGTH, WALLET_TYPES, type WalletType } from "@/lib/constants";

interface EditWalletDialogProps {
  wallet: Wallet;
}

export function EditWalletDialog({ wallet }: EditWalletDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(wallet.name);
  const [type, setType] = useState<WalletType>(wallet.type);

  const { mutate: updateWallet, isPending, error, reset } = useUpdateWalletMutation();

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (open) {
      setName(wallet.name);
      setType(wallet.type);
    } else {
      reset();
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateWallet(
      { walletId: wallet.id, req: { name, type } },
      { onSuccess: () => handleOpenChange(false) },
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="btn-edit-wallet" variant="outline" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit wallet</DialogTitle>
          <DialogDescription>Only the name and type can be changed here.</DialogDescription>
        </DialogHeader>

        {error && <ErrorBanner message="Could not update the wallet. Check the fields and try again." />}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-wallet-name">Name</Label>
            <Input
              id="edit-wallet-name"
              data-testid="input-edit-wallet-name"
              required
              maxLength={WALLET_NAME_MAX_LENGTH}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-wallet-type">Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as WalletType)}>
              <SelectTrigger id="edit-wallet-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WALLET_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="submit" data-testid="btn-edit-wallet-submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
