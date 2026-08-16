"use client";

import { useState } from "react";

import { ErrorBanner } from "@/components/shared/error-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useCreateTransactionMutation } from "@/features/transactions/api/use-create-transaction-mutation";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import type { ChatAction } from "@/features/ai-chat/types";
import { getErrorMessage } from "@/lib/axios";
import { formatCurrency, toCents, toMajorUnits } from "@/lib/currency";

interface ConfirmationCardProps {
  action: ChatAction;
}

// One proposed Transaction, confirmable independently of any other card from
// the same proposal (specs/ai-chat-assistant/spec.md Edge Case #3 — no
// batch/atomic confirm). Confirm reuses the existing, unchanged
// useCreateTransactionMutation — this component never duplicates F-06's
// create logic, only passes the pre-generated idempotency_key through.
//
// Every field the AI proposed is editable before confirming (amount,
// category, wallet, date, note) except type — the AI can be wrong (wrong
// category, mis-parsed amount), and the User must be able to correct it
// rather than only Confirm-or-Cancel. `type` stays fixed, same immutability
// precedent as manual Transaction editing (UpdateTransactionRequest has no
// type field either).
export function ConfirmationCard({ action }: ConfirmationCardProps) {
  const [isCancelled, setIsCancelled] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [walletId, setWalletId] = useState(action.payload.wallet_id);
  const [categoryId, setCategoryId] = useState(action.payload.category_id);
  const [amount, setAmount] = useState(String(toMajorUnits(action.payload.amount)));
  const [occurredAt, setOccurredAt] = useState(action.payload.occurred_at.slice(0, 10));
  const [note, setNote] = useState(action.payload.note ?? "");

  const { data: wallets } = useWalletsQuery();
  const { data: categories } = useCategoriesQuery(action.payload.type);
  const { mutate: createTransaction, isPending, isSuccess, error } = useCreateTransactionMutation();

  const walletName = wallets?.data.find((w) => w.id === walletId)?.name ?? walletId;
  const categoryName = categories?.data.find((c) => c.id === categoryId)?.name ?? categoryId;

  function handleConfirm() {
    createTransaction({
      wallet_id: walletId,
      category_id: categoryId,
      amount: toCents(Number(amount)),
      type: action.payload.type,
      occurred_at: occurredAt,
      note: note || undefined,
      idempotency_key: action.idempotency_key,
    });
  }

  if (isCancelled) {
    return (
      <Card data-testid="card-chat-confirm-action" className="opacity-60">
        <CardContent className="py-3 text-sm text-muted-foreground">Dismissed</CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-chat-confirm-action">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Badge variant={action.payload.type === "income" ? "default" : "secondary"}>
          {action.payload.type === "income" ? "Income" : "Expense"}
        </Badge>
        {isSuccess && (
          <span data-testid="indicator-chat-action-confirmed" className="text-xs font-medium text-green-600">
            Confirmed
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {isEditing ? (
          <>
            <div className="space-y-1">
              <Label htmlFor={`chat-amount-${action.idempotency_key}`}>Amount</Label>
              <Input
                id={`chat-amount-${action.idempotency_key}`}
                data-testid="input-chat-edit-amount"
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`chat-category-${action.idempotency_key}`}>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id={`chat-category-${action.idempotency_key}`} data-testid="select-chat-edit-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories?.data.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.icon && <span className="mr-2">{c.icon}</span>}
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`chat-wallet-${action.idempotency_key}`}>Wallet</Label>
              <Select value={walletId} onValueChange={setWalletId}>
                <SelectTrigger id={`chat-wallet-${action.idempotency_key}`} data-testid="select-chat-edit-wallet">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {wallets?.data.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`chat-date-${action.idempotency_key}`}>Date</Label>
              <Input
                id={`chat-date-${action.idempotency_key}`}
                data-testid="input-chat-edit-date"
                type="date"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`chat-note-${action.idempotency_key}`}>Note</Label>
              <Input
                id={`chat-note-${action.idempotency_key}`}
                data-testid="input-chat-edit-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold">{formatCurrency(toCents(Number(amount)))}</p>
            <p className="text-muted-foreground">
              {categoryName} — {walletName}
            </p>
            <p className="text-muted-foreground">{new Date(occurredAt).toLocaleDateString()}</p>
            {note && <p className="text-muted-foreground">{note}</p>}
          </>
        )}
        {error && (
          <ErrorBanner
            testId="banner-chat-error"
            message={getErrorMessage(error, "Could not confirm this transaction.")}
          />
        )}
      </CardContent>
      {!isSuccess && (
        <CardFooter className="gap-2">
          <Button data-testid="btn-chat-confirm-action" size="sm" disabled={isPending} onClick={handleConfirm}>
            {isPending ? "Confirming..." : "Confirm"}
          </Button>
          <Button
            data-testid="btn-chat-edit-action"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => setIsEditing((v) => !v)}
          >
            {isEditing ? "Done" : "Edit"}
          </Button>
          <Button
            data-testid="btn-chat-cancel-action"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => setIsCancelled(true)}
          >
            Cancel
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
