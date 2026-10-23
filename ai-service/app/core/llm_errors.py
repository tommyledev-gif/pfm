"""What of a provider error may reach a log (specs/security-hardening-2026-10 US-08).

Only the error's type, HTTP status and the provider's own error code. Never
str(exc): for a Groq 400 that string carries the response body, whose
`failed_generation` echoes the model's reading of the user's message (amounts,
names, notes), and log lines are kept for weeks off-box.
"""


class NoToolCallError(Exception):
    """The provider answered, but without the forced tool call (a refusal, or a
    reply cut off before the call). stop_reason is the provider's own value."""

    def __init__(self, provider: str, stop_reason: str | None = None) -> None:
        super().__init__(f"{provider} response contained no tool call")
        self.stop_reason = stop_reason


def provider_error_code(exc: Exception) -> str | None:
    """The provider's error code ("tool_use_failed", "rate_limit_exceeded", …),
    which error_type alone cannot tell apart. Read from the parsed body, and
    only the code."""
    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        error = body.get("error", body)
        if isinstance(error, dict):
            code = error.get("code") or error.get("type")
            return code if isinstance(code, str) else None
    return None


def provider_error_fields(exc: Exception) -> dict[str, object]:
    """Log `extra` fields describing exc without any of its text."""
    fields: dict[str, object] = {"error_type": type(exc).__name__}
    status_code = getattr(exc, "status_code", None)
    if isinstance(status_code, int):
        fields["status_code"] = status_code
    code = provider_error_code(exc)
    if code is not None:
        fields["error_code"] = code
    if isinstance(exc, NoToolCallError) and exc.stop_reason is not None:
        fields["stop_reason"] = exc.stop_reason
    return fields
