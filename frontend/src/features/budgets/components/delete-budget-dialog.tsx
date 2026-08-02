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
import { useDeleteBudgetMutation } from "@/features/budgets/api/use-delete-budget-mutation";
import type { Budget } from "@/features/budgets/types";

interface DeleteBudgetDialogProps {
  budget: Budget;
  onDeleted?: () => void;
}

// Confirm-before-destructive-action — the delete mutation only fires after
// explicit confirm, never on the first click.
export function DeleteBudgetDialog({ budget, onDeleted }: DeleteBudgetDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { mutate: deleteBudget, isPending, error, reset } = useDeleteBudgetMutation();

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (!open) {
      reset();
    }
  }

  function handleConfirm() {
    deleteBudget(budget.id, {
      onSuccess: () => {
        handleOpenChange(false);
        onDeleted?.();
      },
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="btn-delete-budget" variant="outline" size="sm">
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="dialog-delete-budget-confirm">
        <DialogHeader>
          <DialogTitle>Delete the budget for &quot;{budget.category_name}&quot;?</DialogTitle>
          <DialogDescription>
            This budget will stop tracking spend for this category. Existing transactions are unaffected.
          </DialogDescription>
        </DialogHeader>

        {error && <ErrorBanner message="Could not delete this budget. Try again." />}

        <DialogFooter>
          <Button
            data-testid="btn-delete-budget-cancel"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            data-testid="btn-delete-budget-confirm"
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
