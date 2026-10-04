import { isAxiosError, isCancel } from "axios";

import { getErrorCode, getErrorMessage, isNetworkError } from "@/lib/api-envelope";
import { HTTP_STATUS } from "@/lib/constants";

// How the flusher reacts to a failed send (plan "Error Flows" table).
export type SendFailure =
  // No answer, 408/429 or 5xx: keep Waiting, stop this run.
  | { kind: "transient"; maybeSent: boolean; systemError: boolean }
  // Session changed / refused (owner guard, 401): stop, nothing to blame on the item.
  | { kind: "aborted" }
  // The server answered and refused this item (4xx): Failed, run continues.
  | { kind: "rejected"; code: string | null; message: string };

const FALLBACK_REJECT_MESSAGE = "Không thể lưu giao dịch";

export function classifySendError(error: unknown): SendFailure {
  if (isCancel(error)) return { kind: "aborted" };
  if (isNetworkError(error)) return { kind: "transient", maybeSent: true, systemError: false };
  const status = isAxiosError(error) ? error.response?.status : undefined;
  if (status === undefined) return { kind: "transient", maybeSent: false, systemError: false };
  if (status === HTTP_STATUS.unauthorized) return { kind: "aborted" };
  if (status === HTTP_STATUS.requestTimeout || status === HTTP_STATUS.tooManyRequests) {
    return { kind: "transient", maybeSent: false, systemError: false };
  }
  // A 5xx may come after the write committed, so a later resend is treated
  // as possibly duplicate — the shared key makes it safe either way.
  if (status >= HTTP_STATUS.serverErrorMin) return { kind: "transient", maybeSent: true, systemError: true };
  return {
    kind: "rejected",
    code: getErrorCode(error) ?? null,
    message: getErrorMessage(error, FALLBACK_REJECT_MESSAGE),
  };
}
