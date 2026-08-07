from fastapi.testclient import TestClient

from odyssey_api.main import app


def test_health() -> None:
    response = TestClient(app).get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "odyssey-api"}
