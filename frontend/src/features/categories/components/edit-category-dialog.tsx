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
import { useUpdateCategoryMutation } from "@/features/categories/api/use-update-category-mutation";
import type { Category } from "@/features/categories/types";
import { CATEGORY_ICON_MAX_LENGTH, CATEGORY_NAME_MAX_LENGTH } from "@/lib/constants";

interface EditCategoryDialogProps {
  category: Category;
}

// type is never editable here — spec.md: "type is never accepted by this
// endpoint" (structurally excluded on the backend, not just hidden in the UI).
export function EditCategoryDialog({ category }: EditCategoryDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(category.name);
  const [icon, setIcon] = useState(category.icon ?? "");

  const { mutate: updateCategory, isPending, error, reset } = useUpdateCategoryMutation();

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (open) {
      setName(category.name);
      setIcon(category.icon ?? "");
    } else {
      reset();
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateCategory(
      { categoryId: category.id, req: { name, icon } },
      { onSuccess: () => handleOpenChange(false) },
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="btn-edit-category" variant="outline" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit category</DialogTitle>
          <DialogDescription>Only the name and icon can be changed here.</DialogDescription>
        </DialogHeader>

        {error && <ErrorBanner message="Could not update the category. Check the fields and try again." />}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-category-name">Name</Label>
            <Input
              id="edit-category-name"
              data-testid="input-edit-category-name"
              required
              maxLength={CATEGORY_NAME_MAX_LENGTH}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-category-icon">Icon</Label>
            <Input
              id="edit-category-icon"
              data-testid="input-edit-category-icon"
              maxLength={CATEGORY_ICON_MAX_LENGTH}
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              disabled={isPending}
            />
          </div>

          <DialogFooter>
            <Button type="submit" data-testid="btn-edit-category-submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
