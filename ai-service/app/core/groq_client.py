"""Singleton Groq (primary) and Anthropic (fallback) clients.

Kept as thin, swappable singletons — extract_service.py only ever calls
through these two functions, never instantiates an SDK client directly, so
swapping either provider's client construction later touches only this file
(dev.md LLM Rules: "structure code so swapping to Anthropic requires only
changing the client, not the service logic" — applied here to both sides).
"""

from functools import lru_cache

import anthropic
import groq

from app.core.config import settings


@lru_cache(maxsize=1)
def get_groq_client() -> groq.Groq:
    """Extract/category-suggestion client. The SDK defaults (60 s timeout, 2
    retries) let one call outlive the Go backend's 15 s request budget, and
    the Anthropic fallback would only start after that. No SDK retries: the
    fallback is the retry, and the two timeouts together must stay inside the
    backend's budget."""
    return groq.Groq(api_key=settings.groq_api_key, max_retries=0, timeout=settings.primary_timeout_seconds)


@lru_cache(maxsize=1)
def get_groq_consult_client() -> groq.Groq:
    """Consult's own client: no SDK retries (the default of 2 would retry a
    429, which the design forbids) and a timeout inside the backend's budget
    (specs/ai-chat-query-spending/plan.md F12)."""
    return groq.Groq(api_key=settings.groq_api_key, max_retries=0, timeout=settings.consult_timeout_seconds)


@lru_cache(maxsize=1)
def get_anthropic_client() -> anthropic.Anthropic:
    """Fallback client: the SDK default timeout is 10 minutes, far past the
    Go backend's 15 s budget, so it is capped to what is left after the
    primary's timeout."""
    return anthropic.Anthropic(api_key=settings.anthropic_api_key, max_retries=0, timeout=settings.fallback_timeout_seconds)
