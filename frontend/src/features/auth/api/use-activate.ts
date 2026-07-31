import axios from "axios";
import { useMutation } from "@tanstack/react-query";

import type { ActivateRequest, ActivateResult } from "@/features/auth/types";

// Calls the Next.js route handler directly (/api/auth/activate), NOT the
// /api/proxy BFF — mirrors use-login.ts, since this is the other endpoint
// allowed to see the raw token pair and mint the session cookies.
async function activate(req: ActivateRequest): Promise<ActivateResult> {
  const { data } = await axios.post<ActivateResult>("/api/auth/activate", req);
  return data;
}

export function useActivateMutation() {
  return useMutation({ mutationFn: activate });
}
