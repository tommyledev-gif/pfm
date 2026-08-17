"""Environment configuration, read once at startup (pydantic-settings).

Docker Compose injects GROQ_API_KEY/ANTHROPIC_API_KEY (see docker-compose.yml)
— no value is hardcoded here. Both are optional at the settings level: an
empty groq_api_key means Groq calls fail fast with a clear error rather than
an opaque SDK auth failure, and the Go Backend already treats any failure
from this service as a retryable 502 (specs/ai-chat-assistant/spec.md S-AI-10)
— a missing key does not crash this service at startup.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None)

    groq_api_key: str = ""
    anthropic_api_key: str = ""

    # Groq model choice, made with real evidence rather than a guess
    # (plan.md AI-T23 left exact selection to implementation): live-tested
    # against the actual Groq API with this app's real system prompt/schema,
    # llama-3.1-8b-instant was fast but unreliable at Category matching for
    # Vietnamese input — it picked a wrong Category (e.g. "Bonus" for "nhận
    # lương", an unambiguous salary/income message) across every one of
    # several repeated tests, even at temperature=0. Switching to
    # llama-3.3-70b-versatile fixed every one of those same test cases.
    #
    # llama-3.3-70b-versatile was shut down by Groq on 2026-08-16
    # (console.groq.com/docs/deprecations) — every /extract call started
    # failing with a 404 model_not_found, and since ANTHROPIC_API_KEY isn't
    # configured in this environment, the Anthropic fallback had nothing to
    # fall back to either, surfacing as a 503 all the way up to the Go
    # Backend. Moved to Groq's own recommended migration target for tool-use
    # workloads. Overridable via env if Groq's catalog changes again.
    groq_model: str = "openai/gpt-oss-120b"
    anthropic_model: str = "claude-3-5-haiku-20241022"

    # max_tokens must always be set explicitly on every LLM call (dev.md LLM
    # Rules) — never rely on the SDK's default.
    max_tokens: int = 1024
    # This is structured extraction/classification, not creative writing —
    # temperature=0 makes category/amount/type matching deterministic and
    # repeatable. Never rely on the SDK default (~0.7-1.0), which was
    # observed (live testing) to return a different, often wrong, Category
    # for the identical input across repeated calls.
    temperature: float = 0.0


settings = Settings()
