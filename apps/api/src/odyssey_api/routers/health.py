from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["system"])


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Check API health",
    description="Return process-level availability without accessing the database.",
    operation_id="getHealth",
    responses={
        200: {
            "description": "The API process is available.",
            "content": {
                "application/json": {"example": {"status": "ok", "service": "odyssey-api"}}
            },
        }
    },
)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", service="odyssey-api")
