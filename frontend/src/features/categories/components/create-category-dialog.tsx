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
import { useCreateCategoryMutation } from "@/features/categories/api/use-create-category-mutation";
import { CATEGORY_ICON_MAX_LENGTH, CATEGORY_NAME_MAX_LENGTH, CATEGORY_TYPES, type CategoryType } from "@/lib/constants";

const DEFAULT_TYPE: CategoryType = "expense";

export function CreateCategoryDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [type, setType] = useState<CategoryType>(DEFAULT_TYPE);

  const { mutate: createCategory, isPending, error, reset } = useCreateCategoryMutation();

  function resetForm() {
    setName("");
    setIcon("");
    setType(DEFAULT_TYPE);
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
    createCategory(
      { name, icon: icon === "" ? undefined : icon, type },
      { onSuccess: () => handleOpenChange(false) },
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="btn-create-category">Create category</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new category</DialogTitle>
          <DialogDescription>Categories classify your transactions for budgeting and reporting.</DialogDescription>
        </DialogHeader>

        {error && (
          <ErrorBanner testId="banner-category-error" message="Could not create the category. Check the fields and try again." />
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              data-testid="input-category-name"
              required
              maxLength={CATEGORY_NAME_MAX_LENGTH}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-icon">Icon (optional)</Label>
            <Input
              id="category-icon"
              data-testid="input-category-icon"
              maxLength={CATEGORY_ICON_MAX_LENGTH}
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              disabled={isPending}
              placeholder="🍔"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-type">Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as CategoryType)}>
              <SelectTrigger id="category-type" data-testid="select-category-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="submit" data-testid="btn-category-submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
