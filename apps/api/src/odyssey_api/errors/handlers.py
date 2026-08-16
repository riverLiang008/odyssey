from collections.abc import Sequence

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import JsonValue

from odyssey_api.dependencies.workspace import CurrentWorkspaceUnavailableError
from odyssey_api.errors.models import ApplicationError, ErrorCode


def _validation_issues(errors: Sequence[dict[str, object]]) -> list[dict[str, JsonValue]]:
    issues: list[dict[str, JsonValue]] = []
    for error in errors:
        location = error.get("loc", ())
        path = [segment for segment in location if isinstance(segment, str | int)]
        issue_type = error.get("type", "value_error")
        issues.append(
            {
                "path": path,
                "code": issue_type if isinstance(issue_type, str) else "value_error",
            }
        )
    return issues


def _status_for(error: ApplicationError) -> int:
    if error.code is ErrorCode.NOT_FOUND:
        return 404
    if error.code in {ErrorCode.REVISION_CONFLICT, ErrorCode.STATE_CONFLICT}:
        return 409
    return 422


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApplicationError)
    async def handle_application_error(_: Request, error: ApplicationError) -> JSONResponse:
        return JSONResponse(
            status_code=_status_for(error),
            content={"error": {"code": error.code.value, "details": error.details}},
        )

    @app.exception_handler(RequestValidationError)
    async def handle_request_validation(_: Request, error: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": ErrorCode.VALIDATION_FAILED.value,
                    "details": {"issues": _validation_issues(error.errors())},
                }
            },
        )

    @app.exception_handler(CurrentWorkspaceUnavailableError)
    async def handle_workspace_unavailable(
        _: Request, __: CurrentWorkspaceUnavailableError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={
                "error": {
                    "code": ErrorCode.CURRENT_WORKSPACE_UNAVAILABLE.value,
                    "details": {},
                }
            },
        )
