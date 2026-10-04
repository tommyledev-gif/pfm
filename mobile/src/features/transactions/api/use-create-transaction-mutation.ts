import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  afterTransactionCreated,
  createTransactionRequest,
} from "@/features/transactions/api/create-transaction-request";
import { CreateTransactionRequest } from "@/features/transactions/types";

export function useCreateTransactionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTransactionRequest) => createTransactionRequest(body),
    onSuccess: (transaction) => afterTransactionCreated(queryClient, transaction),
  });
}
