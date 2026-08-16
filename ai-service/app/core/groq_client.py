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
def get_anthropic_client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=settings.anthropic_api_key)
