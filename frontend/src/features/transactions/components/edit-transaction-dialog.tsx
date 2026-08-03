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
import { useUpdateTransactionMutation } from "@/features/transactions/api/use-update-transaction-mutation";
import type { Transaction } from "@/features/transactions/types";
import { TRANSACTION_NOTE_MAX_LENGTH } from "@/lib/constants";
import { toCents, toMajorUnits } from "@/lib/currency";
import { getErrorMessage } from "@/lib/axios";

interface EditTransactionDialogProps {
  transaction: Transaction;
}

// No wallet_id or type field anywhere in this form — mirrors the backend
// DTO's structural exclusion (spec.md Context #5): moving a Transaction to a
// different wallet, or flipping income/expense, is out of scope; the user
// must delete and recreate instead.
export function EditTransactionDialog({ transaction }: EditTransactionDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [categoryId, setCategoryId] = useState(transaction.category_id);
  const [amount, setAmount] = useState(String(toMajorUnits(transaction.amount)));
  const [occurredAt, setOccurredAt] = useState(transaction.occurred_at.slice(0, 10));
  const [note, setNote] = useState(transaction.note ?? "");

  // Category choices are restricted to the transaction's own (immutable)
  // type — a new category_id must still match it (spec.md S-TRX-40).
  const { data: categories } = useCategoriesQuery(transaction.type);
  const { mutate: updateTransaction, isPending, error, reset } = useUpdateTransactionMutation();

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (open) {
      setCategoryId(transaction.category_id);
      setAmount(String(toMajorUnits(transaction.amount)));
      setOccurredAt(transaction.occurred_at.slice(0, 10));
      setNote(transaction.note ?? "");
    } else {
      reset();
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateTransaction(
      {
        transactionId: transaction.id,
        req: {
          amount: toCents(Number(amount)),
          category_id: categoryId,
          occurred_at: occurredAt || undefined,
          note,
        },
      },
      { onSuccess: () => handleOpenChange(false) },
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="btn-edit-transaction" variant="outline" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit transaction</DialogTitle>
          <DialogDescription>
            Correct the amount, category, date, or note. The wallet and type cannot be changed — delete and recreate
            instead.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <ErrorBanner message={getErrorMessage(error, "Could not update the transaction. Check the fields and try again.")} />
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-transaction-category">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId} required>
              <SelectTrigger id="edit-transaction-category">
                <SelectValue placeholder="Select a category" />
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
            <Label htmlFor="edit-transaction-amount">Amount</Label>
            <Input
              id="edit-transaction-amount"
              type="number"
              min="0"
              step="any"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-transaction-date">Date</Label>
            <Input
              id="edit-transaction-date"
              type="date"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-transaction-note">Note (optional)</Label>
            <Input
              id="edit-transaction-note"
              maxLength={TRANSACTION_NOTE_MAX_LENGTH}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="submit" data-testid="btn-edit-transaction-submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
