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
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { useCreateTransactionMutation } from "@/features/transactions/api/use-create-transaction-mutation";
import { TRANSACTION_NOTE_MAX_LENGTH, TRANSACTION_TYPES, type TransactionType } from "@/lib/constants";
import { toCents } from "@/lib/currency";

export function CreateTransactionDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [walletId, setWalletId] = useState("");
  const [type, setType] = useState<TransactionType>("expense");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [note, setNote] = useState("");

  const { data: wallets } = useWalletsQuery();
  // Category picker is filtered by the selected type — a Transaction's type
  // must match its Category's type (spec.md S-TRX-14).
  const { data: categories } = useCategoriesQuery(type);
  const { mutate: createTransaction, isPending, error, reset } = useCreateTransactionMutation();

  function resetForm() {
    setWalletId("");
    setType("expense");
    setCategoryId("");
    setAmount("");
    setOccurredAt("");
    setNote("");
    reset();
  }

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (!open) {
      resetForm();
    }
  }

  function handleTypeChange(value: string) {
    setType(value as TransactionType);
    // The previously selected category may not match the new type — clear
    // it rather than silently submitting a stale, now-mismatched value.
    setCategoryId("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createTransaction(
      {
        wallet_id: walletId,
        category_id: categoryId,
        amount: toCents(Number(amount)),
        type,
        occurred_at: occurredAt || undefined,
        note: note || undefined,
      },
      { onSuccess: () => handleOpenChange(false) },
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="btn-create-transaction">Add transaction</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a transaction</DialogTitle>
          <DialogDescription>Record income or an expense against one of your wallets.</DialogDescription>
        </DialogHeader>

        {error && (
          <ErrorBanner testId="banner-transaction-error" message="Could not record the transaction. Check the fields and try again." />
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="transaction-type">Type</Label>
            <Select value={type} onValueChange={handleTypeChange}>
              <SelectTrigger id="transaction-type" data-testid="toggle-transaction-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSACTION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t === "income" ? "Income" : "Expense"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transaction-wallet">Wallet</Label>
            <Select value={walletId} onValueChange={setWalletId} required>
              <SelectTrigger id="transaction-wallet" data-testid="select-transaction-wallet">
                <SelectValue placeholder="Select a wallet" />
              </SelectTrigger>
              <SelectContent>
                {wallets?.data.map((wallet) => (
                  <SelectItem key={wallet.id} value={wallet.id}>
                    {wallet.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transaction-category">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId} required>
              <SelectTrigger id="transaction-category" data-testid="select-transaction-category">
                <SelectValue placeholder={`Select a ${type} category`} />
              </SelectTrigger>
              <SelectContent>
                {categories?.data.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.icon && <span className="mr-2">{category.icon}</span>}
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transaction-amount">Amount</Label>
            <Input
              id="transaction-amount"
              data-testid="input-transaction-amount"
              type="number"
              min="0"
              step="any"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="transaction-date">Date</Label>
            <Input
              id="transaction-date"
              data-testid="input-transaction-date"
              type="date"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="transaction-note">Note (optional)</Label>
            <Input
              id="transaction-note"
              data-testid="input-transaction-note"
              maxLength={TRANSACTION_NOTE_MAX_LENGTH}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="submit" data-testid="btn-transaction-submit" disabled={isPending || !walletId || !categoryId}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
