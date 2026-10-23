"""Service-to-service authentication (specs/security-hardening-2026-10 US-07).

Only the Go backend may call this service: every route except /health requires
the shared secret AI_SERVICE_TOKEN in the X-Internal-Token header. Without it,
anything that can reach the service on the Docker network could spend the
Groq/Anthropic quota and read what users wrote.

Enforced only once AI_SERVICE_TOKEN is set, so a deployment can roll the
backend (which sends the header) and this service out before the secret
exists; main.py logs a warning while it is unset.
"""

import hmac
from typing import Annotated

from fastapi import Header, HTTPException

from app.core.config import settings

INTERNAL_TOKEN_HEADER = "X-Internal-Token"
_HTTP_UNAUTHORIZED = 401


async def verify_internal_token(
    x_internal_token: Annotated[str | None, Header(alias=INTERNAL_TOKEN_HEADER)] = None,
) -> None:
    """FastAPI dependency: 401 unless the request carries the configured token.
    The comparison is constant-time, so response timing reveals nothing about
    how much of a guess was right."""
    expected = settings.ai_service_token
    if not expected:
        return
    if x_internal_token is None or not hmac.compare_digest(x_internal_token.encode(), expected.encode()):
        raise HTTPException(status_code=_HTTP_UNAUTHORIZED, detail="unauthorized")
