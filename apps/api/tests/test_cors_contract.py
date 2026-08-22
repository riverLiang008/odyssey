import pytest
from fastapi.testclient import TestClient

from odyssey_api.main import create_app
from odyssey_api.settings import Settings


@pytest.mark.parametrize(
    "origin",
    [
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
)
@pytest.mark.parametrize("method", ["GET", "POST", "PUT", "DELETE"])
def test_development_cors_preflight(origin: str, method: str, monkeypatch) -> None:
    monkeypatch.setattr(
        "odyssey_api.main.get_settings",
        lambda: Settings(environment="development"),
    )
    response = TestClient(create_app()).options(
        "/api/v1/journeys",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": method,
            "Access-Control-Request-Headers": "If-Match,Content-Type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert "if-match" in response.headers["access-control-allow-headers"].lower()
