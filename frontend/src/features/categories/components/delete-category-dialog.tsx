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
import { useDeleteCategoryMutation } from "@/features/categories/api/use-delete-category-mutation";
import type { Category } from "@/features/categories/types";

interface DeleteCategoryDialogProps {
  category: Category;
  onDeleted?: () => void;
}

// Confirm-before-destructive-action — the delete mutation only fires after
// explicit confirm, never on the first click (implementation-checklist.md:
// "Frontend delete confirmation").
export function DeleteCategoryDialog({ category, onDeleted }: DeleteCategoryDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { mutate: deleteCategory, isPending, error, reset } = useDeleteCategoryMutation();

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (!open) {
      reset();
    }
  }

  function handleConfirm() {
    deleteCategory(category.id, {
      onSuccess: () => {
        handleOpenChange(false);
        onDeleted?.();
      },
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="btn-delete-category" variant="outline" size="sm">
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="dialog-delete-category-confirm">
        <DialogHeader>
          <DialogTitle>Delete &quot;{category.name}&quot;?</DialogTitle>
          <DialogDescription>
            This category will no longer appear in your list. Existing transactions keep their history unaffected.
          </DialogDescription>
        </DialogHeader>

        {error && <ErrorBanner message="Could not delete this category. Try again." />}

        <DialogFooter>
          <Button
            data-testid="btn-delete-category-cancel"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            data-testid="btn-delete-category-confirm"
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
