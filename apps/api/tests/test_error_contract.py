from fastapi import APIRouter
from fastapi.testclient import TestClient
from pydantic import BaseModel, ConfigDict

from odyssey_api.main import create_app


class StrictBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    value: int


def test_request_validation_uses_stable_error_envelope() -> None:
    app = create_app()
    router = APIRouter()

    @router.post("/contract-test")
    async def contract_test(_: StrictBody) -> dict[str, bool]:
        return {"ok": True}

    app.include_router(router)
    response = TestClient(app).post("/contract-test", json={"value": "bad", "extra": True})

    assert response.status_code == 422
    payload = response.json()
    assert payload["error"]["code"] == "VALIDATION_FAILED"
    issues = payload["error"]["details"]["issues"]
    assert {tuple(issue["path"]) for issue in issues} == {("body", "value"), ("body", "extra")}
