import { SwitchResponse } from "@/features/accounts/types";

// Mirrors dto.RevokeAllSessionsResponse — same shape as a switch: a fresh
// session pair + switch token for THIS device (spec BR-12).
export type RevokeAllSessionsResponse = SwitchResponse;
