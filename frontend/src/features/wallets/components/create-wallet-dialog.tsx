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
import { useCreateWalletMutation } from "@/features/wallets/api/use-create-wallet-mutation";
import { WALLET_CURRENCIES, WALLET_NAME_MAX_LENGTH, WALLET_TYPES, type WalletCurrency, type WalletType } from "@/lib/constants";
import { toCents } from "@/lib/currency";

const DEFAULT_TYPE: WalletType = "cash";
const DEFAULT_CURRENCY: WalletCurrency = "VND";

export function CreateWalletDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<WalletType>(DEFAULT_TYPE);
  const [currency, setCurrency] = useState<WalletCurrency>(DEFAULT_CURRENCY);
  const [initialBalance, setInitialBalance] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const { mutate: createWallet, isPending, error, reset } = useCreateWalletMutation();

  function resetForm() {
    setName("");
    setType(DEFAULT_TYPE);
    setCurrency(DEFAULT_CURRENCY);
    setInitialBalance("");
    setIsDefault(false);
    reset();
  }

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (!open) {
      resetForm();
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedBalance = Number(initialBalance);
    createWallet(
      {
        name,
        type,
        currency,
        initial_balance: initialBalance === "" ? 0 : toCents(parsedBalance),
        is_default: isDefault,
      },
      { onSuccess: () => handleOpenChange(false) },
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="btn-create-wallet">Create wallet</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new wallet</DialogTitle>
          <DialogDescription>A wallet is a source or destination of money, like cash or a bank account.</DialogDescription>
        </DialogHeader>

        {error && (
          <ErrorBanner testId="banner-wallet-error" message="Could not create the wallet. Check the fields and try again." />
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wallet-name">Name</Label>
            <Input
              id="wallet-name"
              data-testid="input-wallet-name"
              required
              maxLength={WALLET_NAME_MAX_LENGTH}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wallet-type">Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as WalletType)}>
              <SelectTrigger id="wallet-type" data-testid="select-wallet-type">
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

          <div className="space-y-2">
            <Label htmlFor="wallet-currency">Currency</Label>
            <Select value={currency} onValueChange={(value) => setCurrency(value as WalletCurrency)}>
              <SelectTrigger id="wallet-currency" data-testid="select-wallet-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WALLET_CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wallet-initial-balance">Opening balance (optional)</Label>
            <Input
              id="wallet-initial-balance"
              data-testid="input-wallet-initial-balance"
              type="number"
              min={0}
              step="any"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="wallet-is-default"
              data-testid="toggle-wallet-is-default"
              type="checkbox"
              className="h-4 w-4 rounded border-input"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              disabled={isPending}
            />
            <Label htmlFor="wallet-is-default" className="font-normal">
              Make this my default wallet
            </Label>
          </div>

          <DialogFooter>
            <Button type="submit" data-testid="btn-wallet-submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create wallet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
