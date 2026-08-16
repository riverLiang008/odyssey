from enum import StrEnum

from pydantic import BaseModel, ConfigDict, JsonValue


class ErrorCode(StrEnum):
    VALIDATION_FAILED = "VALIDATION_FAILED"
    NOT_FOUND = "NOT_FOUND"
    REVISION_CONFLICT = "REVISION_CONFLICT"
    STATE_CONFLICT = "STATE_CONFLICT"
    LEGACY_PATTERN_UNSUPPORTED = "LEGACY_PATTERN_UNSUPPORTED"
    CURRENT_WORKSPACE_UNAVAILABLE = "CURRENT_WORKSPACE_UNAVAILABLE"


class ErrorBody(BaseModel):
    """Stable API error body exposed to clients and OpenAPI consumers."""

    model_config = ConfigDict(extra="forbid")

    code: ErrorCode
    details: dict[str, JsonValue]


class ErrorResponse(BaseModel):
    """Canonical error envelope returned by every Odyssey API endpoint."""

    model_config = ConfigDict(extra="forbid")

    error: ErrorBody


class ApplicationError(Exception):
    def __init__(
        self,
        code: ErrorCode,
        *,
        details: dict[str, JsonValue] | None = None,
    ) -> None:
        super().__init__(code.value)
        self.code = code
        self.details = details or {}
