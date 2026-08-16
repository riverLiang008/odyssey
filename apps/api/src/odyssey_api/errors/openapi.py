from odyssey_api.errors.models import ErrorResponse

type OpenApiResponses = dict[int | str, dict[str, object]]


def _error_example(code: str, details: dict[str, object]) -> dict[str, object]:
    return {"error": {"code": code, "details": details}}


COMMON_ERROR_RESPONSES: OpenApiResponses = {
    422: {
        "model": ErrorResponse,
        "description": "The request does not satisfy the API contract.",
        "content": {
            "application/json": {
                "example": _error_example(
                    "VALIDATION_FAILED",
                    {"issues": [{"path": ["body", "name"], "code": "string_too_short"}]},
                )
            }
        },
    },
    503: {
        "model": ErrorResponse,
        "description": "No trusted current Workspace is available.",
        "content": {
            "application/json": {"example": _error_example("CURRENT_WORKSPACE_UNAVAILABLE", {})}
        },
    },
}

NOT_FOUND_RESPONSE: OpenApiResponses = {
    404: {
        "model": ErrorResponse,
        "description": "The resource is not visible in the current Workspace.",
        "content": {"application/json": {"example": _error_example("NOT_FOUND", {})}},
    }
}

CONFLICT_RESPONSE: OpenApiResponses = {
    409: {
        "model": ErrorResponse,
        "description": "The revision is stale or the requested state transition is invalid.",
        "content": {
            "application/json": {
                "examples": {
                    "revisionConflict": {
                        "summary": "Stale aggregate revision",
                        "value": _error_example(
                            "REVISION_CONFLICT",
                            {"expectedRevision": 2, "currentRevision": 3},
                        ),
                    },
                    "stateConflict": {
                        "summary": "Invalid state transition",
                        "value": _error_example("STATE_CONFLICT", {"reason": "SLOT_OCCUPIED"}),
                    },
                }
            }
        },
    }
}


def documented_responses(
    *,
    not_found: bool = False,
    conflict: bool = False,
) -> OpenApiResponses:
    responses = dict(COMMON_ERROR_RESPONSES)
    if not_found:
        responses.update(NOT_FOUND_RESPONSE)
    if conflict:
        responses.update(CONFLICT_RESPONSE)
    return responses
