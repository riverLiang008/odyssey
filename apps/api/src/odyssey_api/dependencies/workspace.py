from dataclasses import dataclass
from typing import Annotated
from uuid import UUID

from fastapi import Depends

from odyssey_api.settings import Settings, get_settings


@dataclass(frozen=True, slots=True)
class CurrentWorkspace:
    id: UUID


class CurrentWorkspaceUnavailableError(RuntimeError):
    """Raised when no trusted Workspace identity is available."""


def get_current_workspace(
    settings: Annotated[Settings, Depends(get_settings)],
) -> CurrentWorkspace:
    if settings.environment == "production":
        raise CurrentWorkspaceUnavailableError(
            "Production requires an authenticated Current Workspace provider"
        )
    if settings.development_workspace_id is None:
        raise CurrentWorkspaceUnavailableError(
            "ODYSSEY_DEVELOPMENT_WORKSPACE_ID must be configured"
        )
    return CurrentWorkspace(id=settings.development_workspace_id)
