"""Offline tests for service-to-service authentication, hidden API docs and
request bounds (specs/security-hardening-2026-10 US-07, S-HRD-29…36)."""

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.schemas.extract_schema import ExtractResponse
from app.schemas.limits import MESSAGE_MAX_CHARS
from app.services import extract_service

TOKEN = "0123456789abcdef0123456789abcdef"
BODY = {"message": "ăn trưa 50k", "wallets": [], "categories": [], "now": "2026-10-23T03:00:00Z"}


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setattr(settings, "ai_service_token", TOKEN)
    monkeypatch.setattr(extract_service, "_call_groq", lambda *_args: ExtractResponse(intent="ambiguous"))
    return TestClient(app)


def test_missing_token_is_401(client: TestClient) -> None:
    assert client.post("/extract", json=BODY).status_code == 401  # S-HRD-29


def test_wrong_token_is_401(client: TestClient) -> None:
    for wrong in ("nope", TOKEN[:-1], TOKEN + "x", ""):
        assert client.post("/extract", json=BODY, headers={"X-Internal-Token": wrong}).status_code == 401  # S-HRD-30


def test_right_token_is_served(client: TestClient) -> None:
    resp = client.post("/extract", json=BODY, headers={"X-Internal-Token": TOKEN})  # S-HRD-31
    assert resp.status_code == 200 and resp.json()["intent"] == "ambiguous"


def test_every_ai_route_requires_the_token(client: TestClient) -> None:
    for path in ("/extract", "/suggest-category-name", "/consult", "/extract-image"):
        assert client.post(path, json={}).status_code == 401, path


def test_health_needs_no_token(client: TestClient) -> None:
    assert client.get("/health").status_code == 200  # S-HRD-32


def test_unset_token_is_not_enforced(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "ai_service_token", "")
    monkeypatch.setattr(extract_service, "_call_groq", lambda *_args: ExtractResponse(intent="ambiguous"))
    assert TestClient(app).post("/extract", json=BODY).status_code == 200  # S-HRD-33


def test_api_docs_are_off_by_default(client: TestClient) -> None:
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert client.get(path).status_code == 404, path  # S-HRD-34


def test_oversized_message_is_refused(client: TestClient) -> None:
    body = {**BODY, "message": "a" * (MESSAGE_MAX_CHARS + 1)}
    assert client.post("/extract", json=body, headers={"X-Internal-Token": TOKEN}).status_code == 422  # S-HRD-36
