import asyncio
from dataclasses import dataclass
from uuid import UUID

from pydantic import JsonValue
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from odyssey_api.db.models import ToolDefinition, Workspace
from odyssey_api.db.session import async_session_factory, engine
from odyssey_api.dependencies.workspace import CurrentWorkspaceUnavailableError
from odyssey_api.settings import Settings, get_settings


@dataclass(frozen=True, slots=True)
class WorkspaceBootstrapResult:
    workspace_id: UUID
    created: bool


@dataclass(frozen=True, slots=True)
class ToolDefinitionSeed:
    id: UUID
    kind: str
    name: str
    category: str
    description: str
    configuration_schema: dict[str, JsonValue]
    input_schema: dict[str, JsonValue]
    output_schema: dict[str, JsonValue]


@dataclass(frozen=True, slots=True)
class ToolDefinitionBootstrapResult:
    created_kinds: tuple[str, ...]
    available_kinds: tuple[str, ...]


BUILTIN_TOOL_DEFINITIONS = (
    ToolDefinitionSeed(
        UUID("0195f076-b6e6-7ef0-98db-d721990f8101"),
        "knowledge_retrieval",
        "Knowledge Retrieval",
        "knowledge",
        "Retrieve documents from a Knowledge Space.",
        {"type": "object"},
        {"type": "object"},
        {"type": "object"},
    ),
    ToolDefinitionSeed(
        UUID("0195f076-b6e6-7ef0-98db-d721990f8102"),
        "script_execution",
        "Script Execution",
        "execution",
        "Execute a Python or JavaScript snippet.",
        {"type": "object"},
        {"type": "object"},
        {"type": "object"},
    ),
    ToolDefinitionSeed(
        UUID("0195f076-b6e6-7ef0-98db-d721990f8103"),
        "api_request",
        "API Request",
        "integration",
        "Call an HTTP API.",
        {"type": "object"},
        {"type": "object"},
        {"type": "object"},
    ),
    ToolDefinitionSeed(
        UUID("0195f076-b6e6-7ef0-98db-d721990f8104"),
        "set_variable",
        "Set Variable",
        "data",
        "Update a Workflow Variable.",
        {"type": "object"},
        {"type": "object"},
        {"type": "object"},
    ),
    ToolDefinitionSeed(
        UUID("0195f076-b6e6-7ef0-98db-d721990f8105"),
        "llm_call",
        "LLM Call",
        "model",
        "Call a configured language model.",
        {"type": "object"},
        {"type": "object"},
        {"type": "object"},
    ),
)


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


async def bootstrap_builtin_tool_definitions(
    session: AsyncSession, settings: Settings
) -> ToolDefinitionBootstrapResult:
    if settings.environment == "production":
        raise CurrentWorkspaceUnavailableError(
            "Development Tool Definition bootstrap is disabled in production"
        )
    created_kinds: list[str] = []
    async with session.begin():
        for definition in BUILTIN_TOOL_DEFINITIONS:
            created = (
                await session.execute(
                    insert(ToolDefinition)
                    .values(
                        id=definition.id,
                        kind=definition.kind,
                        source="built_in",
                        name=definition.name,
                        category=definition.category,
                        description=definition.description,
                        configuration_schema=definition.configuration_schema,
                        input_schema=definition.input_schema,
                        output_schema=definition.output_schema,
                    )
                    .on_conflict_do_nothing(index_elements=[ToolDefinition.kind])
                    .returning(ToolDefinition.kind)
                )
            ).scalar_one_or_none()
            if created is not None:
                created_kinds.append(created)
        expected_kinds = {definition.kind for definition in BUILTIN_TOOL_DEFINITIONS}
        available_kinds = set(
            (
                await session.scalars(
                    select(ToolDefinition.kind).where(ToolDefinition.kind.in_(expected_kinds))
                )
            ).all()
        )
        if available_kinds != expected_kinds:
            raise RuntimeError("Development Tool Definition bootstrap is incomplete")
    return ToolDefinitionBootstrapResult(
        created_kinds=tuple(sorted(created_kinds)),
        available_kinds=tuple(sorted(available_kinds)),
    )


async def _main() -> None:
    settings = get_settings()
    async with async_session_factory() as session:
        result = await bootstrap_development_workspace(session, settings)
    async with async_session_factory() as session:
        tool_result = await bootstrap_builtin_tool_definitions(session, settings)
    await engine.dispose()
    action = "created" if result.created else "already exists"
    print(f"Development Workspace {result.workspace_id} {action}")
    print(
        "Built-in Tool Definitions ready: "
        + ", ".join(tool_result.available_kinds)
        + f" ({len(tool_result.created_kinds)} created)"
    )


if __name__ == "__main__":
    asyncio.run(_main())
