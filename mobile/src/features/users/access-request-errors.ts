import { getErrorCode } from "@/lib/axios";

export const REQUEST_NOT_WAITING = "Yêu cầu này không còn chờ duyệt.";

// A stale row: the email link or another admin already approved or rejected
// the request. The server says 409 ACCESS_REQUEST_HANDLED, or 404 once a
// rejection has removed the row. Both mean the same thing here.
export function isRequestNoLongerWaiting(error: unknown): boolean {
  const code = getErrorCode(error);
  return code === "ACCESS_REQUEST_HANDLED" || code === "NOT_FOUND";
}
