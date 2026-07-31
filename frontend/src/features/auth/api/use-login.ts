import axios from "axios";
import { useMutation } from "@tanstack/react-query";

import type { LoginRequest, LoginResult } from "@/features/auth/types";

// Calls the Next.js route handler directly (/api/auth/login), NOT the
// /api/proxy BFF — this is the one endpoint allowed to see the raw token
// pair so it can mint the httpOnly session cookies (see route.ts).
async function login(req: LoginRequest): Promise<LoginResult> {
  const { data } = await axios.post<LoginResult>("/api/auth/login", req);
  return data;
}

export function useLoginMutation() {
  return useMutation({ mutationFn: login });
}
