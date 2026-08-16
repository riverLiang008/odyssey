from pathlib import Path
from uuid import UUID

from odyssey_api.settings import REPOSITORY_ENV_FILE, REPOSITORY_ROOT, Settings


def test_repository_root_env_path_is_independent_of_working_directory(
    tmp_path: Path,
    monkeypatch,
) -> None:
    monkeypatch.chdir(tmp_path)
    assert REPOSITORY_ENV_FILE == REPOSITORY_ROOT / ".env"
    assert REPOSITORY_ENV_FILE.is_absolute()


def test_documented_env_fields_load_from_env_file(tmp_path: Path) -> None:
    workspace_id = UUID("0195f076-b6e6-7ef0-98db-d721990f8001")
    env_file = tmp_path / ".env"
    env_file.write_text(
        "ODYSSEY_ENVIRONMENT=development\n"
        f"ODYSSEY_DEVELOPMENT_WORKSPACE_ID={workspace_id}\n"
        "ODYSSEY_DEVELOPMENT_WORKSPACE_NAME=Documented Workspace\n",
        encoding="utf-8",
    )
    settings = Settings(_env_file=env_file)
    assert settings.development_workspace_id == workspace_id
    assert settings.development_workspace_name == "Documented Workspace"
