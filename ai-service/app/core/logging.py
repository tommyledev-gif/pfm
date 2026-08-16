"""Structured logging setup — without this, the `extra={...}` fields passed
to every logger.warning/error/info call (error_type, error, prompt_chars,
completion_tokens) are silently dropped, since Python's default logging
format string doesn't render LogRecord extras. Call configure_logging() once,
at startup (app/main.py)."""

import json
import logging

_RESERVED_RECORD_ATTRS = set(logging.LogRecord(name="", level=0, pathname="", lineno=0, msg="", args=(), exc_info=None).__dict__)


class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        # Everything passed via extra={...} that isn't a stdlib LogRecord
        # field — this is how error_type/error/prompt_chars/completion_tokens
        # actually reach the log output.
        for key, value in record.__dict__.items():
            if key not in _RESERVED_RECORD_ATTRS:
                payload[key] = value
        return json.dumps(payload, default=str)


def configure_logging() -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JSONFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)
