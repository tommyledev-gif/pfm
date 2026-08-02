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
import { useDeleteTransactionMutation } from "@/features/transactions/api/use-delete-transaction-mutation";
import type { Transaction } from "@/features/transactions/types";

interface DeleteTransactionDialogProps {
  transaction: Transaction;
}

// Confirm-before-destructive-action — the delete mutation only fires after
// explicit confirm, never on the first click.
export function DeleteTransactionDialog({ transaction }: DeleteTransactionDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { mutate: deleteTransaction, isPending, error, reset } = useDeleteTransactionMutation();

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (!open) {
      reset();
    }
  }

  function handleConfirm() {
    deleteTransaction(transaction.id, { onSuccess: () => handleOpenChange(false) });
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="btn-delete-transaction" variant="outline" size="sm">
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="dialog-delete-transaction-confirm">
        <DialogHeader>
          <DialogTitle>Delete this transaction?</DialogTitle>
          <DialogDescription>
            The wallet balance will be reversed to reflect what actually happened. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {error && <ErrorBanner message="Could not delete this transaction. Try again." />}

        <DialogFooter>
          <Button
            data-testid="btn-delete-transaction-cancel"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            data-testid="btn-delete-transaction-confirm"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
