import asyncio
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from odyssey_api.db.models import Workspace
from odyssey_api.db.session import async_session_factory, engine
from odyssey_api.dependencies.workspace import CurrentWorkspaceUnavailableError
from odyssey_api.settings import Settings, get_settings


@dataclass(frozen=True, slots=True)
class WorkspaceBootstrapResult:
    workspace_id: UUID
    created: bool


async def bootstrap_development_workspace(
    session: AsyncSession,
    settings: Settings,
) -> WorkspaceBootstrapResult:
    if settings.environment == "production":
        raise CurrentWorkspaceUnavailableError(
            "Development Workspace bootstrap is disabled in production"
        )
    workspace_id = settings.development_workspace_id
    if workspace_id is None:
        raise CurrentWorkspaceUnavailableError(
            "ODYSSEY_DEVELOPMENT_WORKSPACE_ID must be configured"
        )

    async with session.begin():
        inserted_id = (
            await session.execute(
                insert(Workspace)
                .values(
                    id=workspace_id,
                    name=settings.development_workspace_name,
                    description="Local development Workspace",
                )
                .on_conflict_do_nothing(index_elements=[Workspace.id])
                .returning(Workspace.id)
            )
        ).scalar_one_or_none()
        exists = (
            await session.execute(select(Workspace.id).where(Workspace.id == workspace_id))
        ).scalar_one_or_none()
        if exists is None:
            raise RuntimeError("Development Workspace bootstrap did not persist its target")
        return WorkspaceBootstrapResult(
            workspace_id=workspace_id,
            created=inserted_id is not None,
        )


async def _main() -> None:
    settings = get_settings()
    async with async_session_factory() as session:
        result = await bootstrap_development_workspace(session, settings)
    await engine.dispose()
    action = "created" if result.created else "already exists"
    print(f"Development Workspace {result.workspace_id} {action}")


if __name__ == "__main__":
    asyncio.run(_main())
