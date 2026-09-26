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
    return groq.Groq(api_key=settings.groq_api_key)


@lru_cache(maxsize=1)
def get_groq_consult_client() -> groq.Groq:
    """Consult's own client: no SDK retries (the default of 2 would retry a
    429, which the design forbids) and a timeout inside the backend's budget
    (specs/ai-chat-query-spending/plan.md F12)."""
    return groq.Groq(api_key=settings.groq_api_key, max_retries=0, timeout=settings.consult_timeout_seconds)


@lru_cache(maxsize=1)
def get_anthropic_client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=settings.anthropic_api_key)
