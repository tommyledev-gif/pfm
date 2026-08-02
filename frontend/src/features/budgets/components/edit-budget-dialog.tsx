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
import { useUpdateBudgetMutation } from "@/features/budgets/api/use-update-budget-mutation";
import { CurrencyLimitRowInput, type LimitRowValue } from "@/features/budgets/components/currency-limit-row-input";
import type { Budget } from "@/features/budgets/types";
import { WALLET_CURRENCIES } from "@/lib/constants";
import { toCents, toMajorUnits } from "@/lib/currency";

interface EditBudgetDialogProps {
  budget: Budget;
}

function rowsFromBudget(budget: Budget): LimitRowValue[] {
  return budget.limits.map((limit) => ({ currency: limit.currency, amount: String(toMajorUnits(limit.amount_limit)) }));
}

// PATCH replaces the ENTIRE `limits` map (spec.md Edge Case US-04 #1) — this
// dialog must pre-populate every existing currency row before allowing
// edits, since silently dropping a row the user didn't touch would delete
// that currency's tracking (plan.md Constitution Notes: "Frontend
// full-replace UX").
export function EditBudgetDialog({ budget }: EditBudgetDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rows, setRows] = useState<LimitRowValue[]>(() => rowsFromBudget(budget));

  const { mutate: updateBudget, isPending, error, reset } = useUpdateBudgetMutation();

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (open) {
      setRows(rowsFromBudget(budget));
    } else {
      reset();
    }
  }

  function updateRow(index: number, value: LimitRowValue) {
    setRows((prev) => prev.map((row, i) => (i === index ? value : row)));
  }

  function addRow() {
    const used = new Set(rows.map((r) => r.currency));
    const next = WALLET_CURRENCIES.find((c) => !used.has(c)) ?? WALLET_CURRENCIES[0];
    setRows((prev) => [...prev, { currency: next, amount: "" }]);
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
    updateBudget({ budgetId: budget.id, req: { limits } }, { onSuccess: () => handleOpenChange(false) });
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="btn-edit-budget" variant="outline" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit budget for {budget.category_name}</DialogTitle>
          <DialogDescription>
            Saving replaces every currency limit below — remove a row to stop tracking that currency.
          </DialogDescription>
        </DialogHeader>

        {error && <ErrorBanner message="Could not update the budget. Check the fields and try again." />}

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Button type="submit" data-testid="btn-edit-budget-submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
