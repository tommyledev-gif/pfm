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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useCreateBudgetMutation } from "@/features/budgets/api/use-create-budget-mutation";
import { CurrencyLimitRowInput, type LimitRowValue } from "@/features/budgets/components/currency-limit-row-input";
import { WALLET_CURRENCIES, type WalletCurrency } from "@/lib/constants";
import { toCents } from "@/lib/currency";

const DEFAULT_ROWS: LimitRowValue[] = [{ currency: "VND", amount: "" }];

function nextUnusedCurrency(rows: LimitRowValue[]): WalletCurrency {
  const used = new Set(rows.map((r) => r.currency));
  return WALLET_CURRENCIES.find((c) => !used.has(c)) ?? WALLET_CURRENCIES[0];
}

export function CreateBudgetDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [rows, setRows] = useState<LimitRowValue[]>(DEFAULT_ROWS);

  // Only expense categories are eligible (spec.md Business invariants) — a
  // Budget on an income category has no "spending limit" meaning.
  const { data: categories } = useCategoriesQuery("expense");
  const { mutate: createBudget, isPending, error, reset } = useCreateBudgetMutation();

  function resetForm() {
    setCategoryId("");
    setRows(DEFAULT_ROWS);
    reset();
  }

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (!open) {
      resetForm();
    }
  }

  function updateRow(index: number, value: LimitRowValue) {
    setRows((prev) => prev.map((row, i) => (i === index ? value : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, { currency: nextUnusedCurrency(prev), amount: "" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const limits: Record<string, number> = {};
    for (const row of rows) {
      limits[row.currency] = toCents(Number(row.amount));
    }
    createBudget({ category_id: categoryId, limits }, { onSuccess: () => handleOpenChange(false) });
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="btn-create-budget">Create budget</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new budget</DialogTitle>
          <DialogDescription>
            Set a spending limit for a category, tracked across all your wallets. Add one limit per currency you
            spend it in.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <ErrorBanner testId="banner-budget-error" message="Could not create the budget. Check the fields and try again." />
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="budget-category">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId} required>
              <SelectTrigger id="budget-category" data-testid="select-budget-category">
                <SelectValue placeholder="Select an expense category" />
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
            <Label>Limits</Label>
            {rows.map((row, index) => (
              <CurrencyLimitRowInput
                key={index}
                value={row}
                usedCurrencies={rows.filter((_, i) => i !== index).map((r) => r.currency)}
                onChange={(value) => updateRow(index, value)}
                onRemove={() => removeRow(index)}
                canRemove={rows.length > 1}
                disabled={isPending}
              />
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="btn-add-limit-row"
              onClick={addRow}
              disabled={isPending || rows.length >= WALLET_CURRENCIES.length}
            >
              Add currency
            </Button>
          </div>

          <DialogFooter>
            <Button type="submit" data-testid="btn-budget-submit" disabled={isPending || !categoryId}>
              {isPending ? "Creating..." : "Create budget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
